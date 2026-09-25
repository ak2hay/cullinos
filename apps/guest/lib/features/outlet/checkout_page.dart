import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/outlet/cart_controller.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';
import 'package:cullinos_guest/widgets/guest_sticky_bars.dart';

// Online preference (gateway still chosen by server) + offline settle options.
enum _PayMethod { upi, card, wallet, payAtCounter, payToWaiter }

class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({
    super.key,
    required this.orgSlug,
    required this.outletSlug,
  });

  final String orgSlug;
  final String outletSlug;

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  final _address = TextEditingController();
  final _pincode = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _coupon = TextEditingController();
  final _tip = TextEditingController(text: '0');

  Map<String, dynamic>? _quote;
  double _couponDiscount = 0;
  bool _loading = false;
  bool _pincodeLoading = false;
  String? _error;
  late Razorpay _razorpay;
  String? _pendingOrderId;
  List<dynamic> _addresses = [];

  // UI-only state
  _PayMethod _payMethod = _PayMethod.upi;
  bool _scheduleDelivery = false;
  DateTime? _scheduledPickupAt;
  int _redeemPoints = 0;
  int _availablePoints = 0;
  double _pointsDiscount = 0;
  final _orderNotes = TextEditingController();
  final _pointsCtrl = TextEditingController();
  bool _enablePayAtCounter = false;
  bool _enablePayToWaiter = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaySuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPayError);
    _loadAddresses();
    _loadLoyalty();
    _loadPaymentOptions();
  }

  Future<void> _loadPaymentOptions() async {
    try {
      final profile = await ref.read(guestApiProvider).outletProfile(
            widget.orgSlug,
            widget.outletSlug,
          );
      final modes = profile['orderModes'] is Map
          ? Map<String, dynamic>.from(profile['orderModes'] as Map)
          : <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        _enablePayAtCounter = modes['enablePayAtCounter'] == true;
        _enablePayToWaiter = modes['enablePayToWaiter'] == true;
      });
    } catch (_) {}
  }

  Future<void> _loadAddresses() async {
    try {
      final rows = await ref.read(guestApiProvider).addresses();
      setState(() => _addresses = rows);
      final def = rows
          .cast<dynamic>()
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where((a) => a['isDefault'] == true);
      if (def.isNotEmpty) {
        _address.text = def.first['line1']?.toString() ?? '';
        _pincode.text = def.first['pincode']?.toString() ?? '';
        _city.text = def.first['city']?.toString() ?? '';
        _state.text = def.first['state']?.toString() ?? '';
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _razorpay.clear();
    _address.dispose();
    _pincode.dispose();
    _city.dispose();
    _state.dispose();
    _coupon.dispose();
    _tip.dispose();
    _orderNotes.dispose();
    _pointsCtrl.dispose();
    super.dispose();
  }

  Future<void> _lookupPincode(String pin) async {
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) return;
    if (_city.text.isNotEmpty && _state.text.isNotEmpty) return;
    setState(() => _pincodeLoading = true);
    try {
      final uri = Uri.parse('https://api.postalpincode.in/pincode/$pin');
      final client = HttpClient();
      final request = await client.getUrl(uri);
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      final data = jsonDecode(body) as List<dynamic>;
      final po = (data[0] as Map<String, dynamic>?)?['PostOffice'];
      if (po is List && po.isNotEmpty) {
        final first = po[0] as Map<String, dynamic>;
        if (_city.text.isEmpty) {
          setState(() => _city.text = first['District']?.toString() ?? '');
        }
        if (_state.text.isEmpty) {
          setState(() => _state.text = first['State']?.toString() ?? '');
        }
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _pincodeLoading = false);
    }
  }

  Future<void> _refreshQuote() async {
    final cart = ref.read(cartProvider);
    if (cart.orderType != 'delivery' || cart.outletId == null) return;
    try {
      final quote = await ref.read(guestApiProvider).deliveryQuote({
        'outletId': cart.outletId,
        'address': _address.text.trim(),
        'pincode': _pincode.text.trim(),
      });
      setState(() => _quote = quote);
    } catch (e) {
      setState(() => _error = friendlyApiError(e));
    }
  }

  Future<void> _applyCoupon() async {
    final cart = ref.read(cartProvider);
    if (cart.orgId == null) return;
    final code = _coupon.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Enter a coupon code');
      return;
    }
    try {
      final res = await ref.read(guestApiProvider).validateCoupon(
            orgId: cart.orgId!,
            code: code,
            orderTotal: cart.subtotal,
          );
      setState(() {
        _couponDiscount = (res['discountAmount'] as num?)?.toDouble() ?? 0;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _couponDiscount = 0;
        _error = friendlyApiError(
          e,
          fallback: 'Coupon not valid for this restaurant.',
        );
      });
    }
  }


  Future<void> _loadLoyalty() async {
    final cart = ref.read(cartProvider);
    final auth = ref.read(authControllerProvider);
    if (cart.orgId == null || !auth.isAuthenticated) return;
    try {
      final token = await auth.customerToken(cart.orgId!);
      if (token == null || token.isEmpty) return;
      final me =
          await ref.read(guestApiProvider).loyaltyMe(cart.orgId!, token);
      final pts = (me['loyaltyPoints'] as num?)?.toInt() ??
          (me['points'] as num?)?.toInt() ??
          0;
      if (mounted) setState(() => _availablePoints = pts);
    } catch (_) {}
  }

  Future<void> _place() async {
    final cart = ref.read(cartProvider);
    final auth = ref.read(authControllerProvider);
    if (cart.lines.isEmpty || cart.orgId == null || cart.outletId == null) {
      setState(() => _error = 'Your cart is empty. Add items before paying.');
      return;
    }
    final tip = double.tryParse(_tip.text) ?? 0;
    final fee = (_quote?['inZone'] == true)
        ? (_quote!['fee'] as num?)?.toDouble() ?? 0
        : 0.0;
    final pointsDiscount = _pointsDiscount;
    final total =
        cart.subtotal - _couponDiscount - pointsDiscount + fee + tip;
    final sessionToken = cart.sessionToken;
    final payLater = sessionToken != null;
    final payOffline = _payMethod == _PayMethod.payAtCounter ||
        _payMethod == _PayMethod.payToWaiter;
    final skipPayment = payLater || payOffline;
    if (total < 0) {
      setState(() => _error = 'Order total is invalid.');
      return;
    }
    if (!skipPayment && total <= 0) {
      setState(() => _error = 'Order total must be greater than zero.');
      return;
    }
    if (!auth.isAuthenticated) {
      setState(() => _error = 'Please sign in to place your order.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      String? customerId = cart.customerId;
      String? customerToken;
      if (customerId == null || customerId.isEmpty) {
        final membership =
            await ref.read(guestApiProvider).ensureMembership(cart.orgId!);
        customerId = membership['customerId'] as String?;
        customerToken = membership['customerAccessToken'] as String? ??
            membership['customerToken'] as String?;
        if (customerToken != null && customerToken.isNotEmpty) {
          await auth.saveCustomerToken(cart.orgId!, customerToken);
        }
        cart.bindOutlet(
          orgId: cart.orgId!,
          outletId: cart.outletId!,
          orgSlug: cart.orgSlug ?? widget.orgSlug,
          outletSlug: cart.outletSlug ?? widget.outletSlug,
          customerId: customerId,
          sessionToken: cart.sessionToken,
        );
      }
      if (customerId == null || customerId.isEmpty) {
        throw Exception('Could not link your account to this restaurant.');
      }
      customerToken ??= await auth.customerToken(cart.orgId!);

      final mappedItems = cart.lines
          .map((l) => {
                'menuItemId': l.menuItemId,
                'quantity': l.quantity,
                if (l.variantId != null) 'variantId': l.variantId,
                if (l.modifiers != null) 'modifiers': l.modifiers,
                if (l.notes != null && l.notes!.isNotEmpty) 'notes': l.notes,
              })
          .toList();

      final noteParts = <String>[
        if (_orderNotes.text.trim().isNotEmpty) _orderNotes.text.trim(),
        if (cart.specialInstructions != null &&
            cart.specialInstructions!.isNotEmpty)
          cart.specialInstructions!,
        if (payLater) 'Payment: Pay later',
        if (_payMethod == _PayMethod.payAtCounter) 'Payment: Pay at counter',
        if (_payMethod == _PayMethod.payToWaiter) 'Payment: Pay to waiter',
        if (_redeemPoints > 0) 'Redeem: $_redeemPoints pts',
      ];
      final orderNotes = noteParts.isEmpty ? null : noteParts.join(' · ');

      late Map<String, dynamic> order;
      if (sessionToken != null && sessionToken.isNotEmpty) {
        await ref.read(guestApiProvider).sessionAddItems(
              sessionToken,
              items: mappedItems,
              customerName: auth.name ?? auth.phone,
              notes: orderNotes,
            );
        order = await ref.read(guestApiProvider).sessionSubmit(sessionToken);
      } else {
        final body = <String, dynamic>{
          'orgSlug': widget.orgSlug,
          'outletSlug': widget.outletSlug,
          'outletId': cart.outletId,
          'source': 'ONLINE',
          'type': cart.orderType,
          'customerId': customerId,
          'tipAmount': tip,
          'idempotencyKey':
              'guest-${DateTime.now().millisecondsSinceEpoch}-${cart.outletId}',
          'items': mappedItems,
          if (orderNotes != null) 'notes': orderNotes,
          if (_coupon.text.trim().isNotEmpty && _couponDiscount > 0)
            'couponCode': _coupon.text.trim(),
          if (_scheduleDelivery && _scheduledPickupAt != null)
            'scheduledPickupAt':
                _scheduledPickupAt!.toUtc().toIso8601String(),
          if (cart.orderType == 'delivery') ...{
            'deliveryAddress': _address.text.trim(),
            'deliveryPincode': _pincode.text.trim(),
            'deliveryCity':
                _city.text.trim().isEmpty ? null : _city.text.trim(),
            'deliveryState':
                _state.text.trim().isEmpty ? null : _state.text.trim(),
            'deliveryZoneId': _quote?['zoneId'],
          },
        };
        try {
          order = await ref.read(guestApiProvider).createOrder(body);
        } on DioException catch (e) {
          final msg = friendlyApiError(e).toLowerCase();
          final isCoupon =
              e.response?.statusCode == 404 && msg.contains('coupon');
          if (isCoupon && body.containsKey('couponCode')) {
            body.remove('couponCode');
            setState(() {
              _couponDiscount = 0;
              _error =
                  'Coupon no longer valid — continuing without discount.';
            });
            order = await ref.read(guestApiProvider).createOrder(body);
          } else {
            rethrow;
          }
        }
      }

      final orderId = order['id'] as String;

      if (_redeemPoints > 0 &&
          customerToken != null &&
          customerToken.isNotEmpty) {
        try {
          await ref.read(guestApiProvider).redeemPoints(
                orgId: cart.orgId!,
                customerToken: customerToken,
                points: _redeemPoints,
              );
        } catch (_) {}
      }

      if (skipPayment) {
        cart.clear();
        if (mounted) {
          final message = payLater
              ? (sessionToken != null
                  ? 'Your items were sent to the table. Pay at the table when ready.'
                  : 'Pay at the counter when your order is ready.')
              : _payMethod == _PayMethod.payToWaiter
                  ? 'Order placed. Pay your waiter when ready.'
                  : 'Order placed. Pay at the counter when ready.';
          await showDialog<void>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Order placed'),
              content: Text(message),
              actions: [
                FilledButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('OK'),
                ),
              ],
            ),
          );
          if (mounted) context.go('/orders/$orderId');
        }
        return;
      }

      final intent = await ref.read(guestApiProvider).paymentIntent(
            orderId,
            preferredMethod: _payMethod.name,
          );
      _pendingOrderId = orderId;
      final provider = intent['provider'] as String? ?? 'razorpay';
      if (provider == 'cashfree') {
        final sessionId = intent['paymentSessionId'] as String?;
        final cfOrderId = intent['cashfreeOrderId'] as String?;
        final mode = intent['mode'] as String? ?? 'sandbox';
        if (sessionId == null || cfOrderId == null) {
          throw Exception(
              'Online payments are not configured for this restaurant.');
        }
        final host = mode == 'production'
            ? 'https://payments.cashfree.com'
            : 'https://sandbox.cashfree.com';
        final uri = Uri.parse(
          '$host/pg/view/sessions/checkout?payment_session_id=$sessionId',
        );
        final launched =
            await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched) {
          throw Exception('Could not open payment checkout.');
        }
        if (!mounted) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            ),
            title: const Text('Complete payment'),
            content: const Text(
              'Finish payment in the browser, then tap Paid to confirm.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(
                  backgroundColor: GuestColors.primaryOf(context),
                ),
                child: const Text('Paid'),
              ),
            ],
          ),
        );
        if (confirmed == true) {
          await ref.read(guestApiProvider).paymentVerify({
            'orderId': orderId,
            'provider': 'cashfree',
            'cashfreeOrderId': cfOrderId,
          });
          cart.clear();
          if (mounted) context.go('/orders/$orderId');
        }
        return;
      }
      final keyId = intent['keyId'] as String?;
      final rzOrderId = intent['razorpayOrderId'] as String?;
      if (keyId == null || rzOrderId == null) {
        throw Exception(
            'Online payments are not configured for this restaurant.');
      }
      _razorpay.open({
        'key': keyId,
        'amount': intent['amountPaise'],
        'name': 'Cullinos',
        'description': 'Order #$orderId',
        'order_id': rzOrderId,
        'currency': 'INR',
        'method': {
          if (_payMethod == _PayMethod.upi) 'upi': true,
          if (_payMethod == _PayMethod.card) 'card': true,
          if (_payMethod == _PayMethod.wallet) 'wallet': true,
        },
      });
    } catch (e) {
      setState(() => _error = friendlyApiError(
            e,
            fallback: 'Order could not be placed. Please try again.',
          ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }


  Future<void> _onPaySuccess(PaymentSuccessResponse response) async {
    final orderId = _pendingOrderId;
    if (orderId == null) return;
    try {
      await ref.read(guestApiProvider).paymentVerify({
        'orderId': orderId,
        'provider': 'razorpay',
        'razorpayOrderId': response.orderId,
        'razorpayPaymentId': response.paymentId,
        'razorpaySignature': response.signature,
      });
      ref.read(cartProvider).clear();
      if (mounted) context.go('/orders/$orderId');
    } catch (e) {
      setState(() => _error = friendlyApiError(
            e,
            fallback: 'Payment verification failed. Contact support if charged.',
          ));
    }
  }

  void _onPayError(PaymentFailureResponse response) {
    setState(() => _error = response.message ?? 'Payment failed. Please try again.');
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  Widget _orderTypeCard({
    required String value,
    required IconData icon,
    required String label,
    required String hint,
    required String current,
    required VoidCallback onTap,
  }) {
    final selected = current == value;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(
            color: selected ? GuestColors.primarySoftOf(context) : GuestColors.surface,
            borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            border: Border.all(
              color: selected ? GuestColors.primaryOf(context) : GuestColors.border,
              width: selected ? 2 : 1,
            ),
            boxShadow: selected
                ? GuestSpacing.softShadow(color: GuestColors.primaryOf(context))
                : GuestSpacing.cardShadow,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  color: selected ? GuestColors.primaryOf(context) : GuestColors.muted,
                  size: 24),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: selected ? GuestColors.primaryOf(context) : GuestColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                hint,
                style: const TextStyle(
                  fontSize: 10,
                  color: GuestColors.muted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _payMethodCard({
    required _PayMethod value,
    required IconData icon,
    required String label,
    required String hint,
    bool expanded = true,
  }) {
    final selected = _payMethod == value;
    final card = GestureDetector(
      onTap: () => setState(() => _payMethod = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: expanded ? null : double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: selected
              ? GuestColors.primarySoftOf(context)
              : GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          border: Border.all(
            color: selected
                ? GuestColors.primaryOf(context)
                : GuestColors.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                color: selected
                    ? GuestColors.primaryOf(context)
                    : GuestColors.muted,
                size: 22),
            const SizedBox(height: 5),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: selected
                    ? GuestColors.primaryOf(context)
                    : GuestColors.ink,
              ),
            ),
            Text(
              hint,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: GuestColors.muted),
            ),
          ],
        ),
      ),
    );
    if (expanded) return Expanded(child: card);
    return card;
  }

  Widget _billRow(String label, String amount, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: bold ? GuestColors.ink : GuestColors.muted,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
          Text(
            amount,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
              color: bold ? GuestColors.ink : GuestColors.muted,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final deliveryFee = _quote?['inZone'] == true
        ? (_quote!['fee'] as num?)?.toDouble() ?? 0
        : 0.0;
    final tip = double.tryParse(_tip.text) ?? 0;
    final total = cart.subtotal + deliveryFee + tip - _couponDiscount;

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.scaffold,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        leading: GuestBackButton(
          fallbackPath: '/o/${widget.orgSlug}/${widget.outletSlug}/cart',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Checkout',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            Text(
              'Almost there!',
              style: TextStyle(
                fontSize: 12,
                color: GuestColors.muted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GuestSpacing.page,
          4,
          GuestSpacing.page,
          120,
        ),
        children: [
          // ── Stepper ─────────────────────────────────────────────────────
          const GuestCheckoutStepper(currentStep: 1),
          const SizedBox(height: 20),

          // ── Section 1: Order type ────────────────────────────────────────
          const GuestSectionHeader(title: 'Order type', emoji: '🧺'),
          const SizedBox(height: 10),
          Row(
            children: [
              _orderTypeCard(
                value: 'delivery',
                icon: Icons.delivery_dining_rounded,
                label: 'Delivery',
                hint: 'To your door',
                current: cart.orderType,
                onTap: () {
                  ref.read(cartProvider).setOrderType('delivery');
                  _refreshQuote();
                },
              ),
              const SizedBox(width: 10),
              _orderTypeCard(
                value: 'dine_in',
                icon: Icons.restaurant_rounded,
                label: 'Dine In',
                hint: 'At the table',
                current: cart.orderType,
                onTap: () =>
                    ref.read(cartProvider).setOrderType('dine_in'),
              ),
              const SizedBox(width: 10),
              _orderTypeCard(
                value: 'takeaway',
                icon: Icons.shopping_bag_rounded,
                label: 'Takeaway',
                hint: 'Pick up ready',
                current: cart.orderType,
                onTap: () =>
                    ref.read(cartProvider).setOrderType('takeaway'),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // ── Section 2: Order summary ─────────────────────────────────────
          const GuestSectionHeader(title: 'Your order', emoji: '🍽️'),
          const SizedBox(height: 10),
          GuestSoftCard(
            child: Column(
              children: [
                ...cart.lines.map(
                  (l) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: GuestColors.primarySoftOf(context),
                            borderRadius: BorderRadius.circular(
                                GuestSpacing.radiusSm),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${l.quantity}',
                            style: TextStyle(
                              color: GuestColors.primaryOf(context),
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            l.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                        Text(
                          '₹${(l.unitPrice * l.quantity).toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: GuestColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Section 3: Delivery address ──────────────────────────────────
          if (cart.orderType == 'delivery') ...[
            const GuestSectionHeader(title: 'Delivery address', emoji: '🛵'),
            const SizedBox(height: 10),
            if (_addresses.isNotEmpty)
              GuestSoftCard(
                child: Column(
                  children: _addresses.map((raw) {
                    final a = Map<String, dynamic>.from(raw as Map);
                    final isDefault = a['isDefault'] == true;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: isDefault
                              ? GuestColors.primarySoftOf(context)
                              : GuestColors.borderLight,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.location_on_rounded,
                          size: 18,
                          color: isDefault
                              ? GuestColors.primaryOf(context)
                              : GuestColors.muted,
                        ),
                      ),
                      title: Text(
                        a['line1']?.toString() ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        [a['pincode'], a['city']]
                            .where((e) => e != null && e.toString().isNotEmpty)
                            .join(' · '),
                        style:
                            const TextStyle(color: GuestColors.muted),
                      ),
                      trailing: isDefault
                          ? Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: GuestColors.primarySoftOf(context),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                'Default',
                                style: TextStyle(
                                  color: GuestColors.primaryDeepOf(context),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            )
                          : const Icon(Icons.chevron_right,
                              color: GuestColors.muted),
                      onTap: () {
                        setState(() {
                          _address.text = a['line1']?.toString() ?? '';
                          _pincode.text = a['pincode']?.toString() ?? '';
                          _city.text = a['city']?.toString() ?? '';
                          _state.text = a['state']?.toString() ?? '';
                        });
                        _refreshQuote();
                      },
                    );
                  }).toList(),
                ),
              ),
            const SizedBox(height: 8),
            GuestSoftCard(
              child: Column(
                children: [
                  TextField(
                    controller: _address,
                    decoration: const InputDecoration(
                      labelText: 'Delivery address',
                      prefixIcon: Icon(Icons.home_outlined),
                    ),
                    onChanged: (_) => _refreshQuote(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pincode,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: 'Pincode',
                      counterText: '',
                      prefixIcon: const Icon(Icons.pin_drop_outlined),
                      suffixIcon: _pincodeLoading
                          ? Padding(
                              padding: const EdgeInsets.all(12),
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: GuestColors.primaryOf(context),
                                ),
                              ),
                            )
                          : null,
                    ),
                    onChanged: (v) {
                      _refreshQuote();
                      if (v.length == 6) _lookupPincode(v);
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _city,
                          decoration:
                              const InputDecoration(labelText: 'City'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _state,
                          decoration:
                              const InputDecoration(labelText: 'State'),
                        ),
                      ),
                    ],
                  ),
                  if (_quote != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _quote!['inZone'] == true
                              ? GuestColors.primarySoftOf(context)
                              : GuestColors.coralSoft,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _quote!['inZone'] == true
                                  ? Icons.check_circle_outline
                                  : Icons.info_outline,
                              size: 16,
                              color: _quote!['inZone'] == true
                                  ? GuestColors.primaryOf(context)
                                  : GuestColors.coralDeep,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _quote!['inZone'] == true
                                    ? 'Delivery fee ₹$deliveryFee · ETA ${_quote!['estimatedMinutes'] ?? '—'} min'
                                    : (_quote!['reason']?.toString() ??
                                        'Out of delivery zone'),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: _quote!['inZone'] == true
                                      ? GuestColors.primaryDeepOf(context)
                                      : GuestColors.coralDeep,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Section 3b: Delivery time ─────────────────────────────────
            const GuestSectionHeader(title: 'Delivery time', emoji: '⏰'),
            const SizedBox(height: 10),
            GuestSoftCard(
              child: Column(
                children: [
                  _DeliveryTimeOption(
                    icon: Icons.bolt_rounded,
                    label: 'ASAP',
                    hint: 'Estimated 30–45 min',
                    selected: !_scheduleDelivery,
                    onTap: () => setState(() => _scheduleDelivery = false),
                  ),
                  const SizedBox(height: 8),
                  _DeliveryTimeOption(
                    icon: Icons.schedule_rounded,
                    label: 'Schedule for later',
                    hint: 'Choose a time slot',
                    selected: _scheduleDelivery,
                    onTap: () => setState(() => _scheduleDelivery = true),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // ── Section 4: Payment method ────────────────────────────────────
          const GuestSectionHeader(title: 'Notes & loyalty', emoji: '📝'),
          const SizedBox(height: 10),
          GuestSoftCard(
            child: Column(
              children: [
                TextField(
                  controller: _orderNotes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Order notes',
                    hintText: 'Any special requests?',
                    prefixIcon: Icon(Icons.notes_outlined),
                  ),
                ),
                if (_availablePoints > 0) ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _pointsCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText:
                          'Redeem points (available $_availablePoints)',
                      prefixIcon: const Icon(Icons.stars_outlined),
                      suffixIcon: TextButton(
                        onPressed: () {
                          final pts =
                              int.tryParse(_pointsCtrl.text.trim()) ?? 0;
                          final use = pts.clamp(0, _availablePoints);
                          setState(() {
                            _redeemPoints = use;
                            _pointsDiscount = use * 0.25;
                          });
                        },
                        child: const Text('Apply'),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (_scheduleDelivery) ...[
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_outlined),
              title: Text(
                _scheduledPickupAt == null
                    ? 'Choose pickup / delivery time'
                    : _scheduledPickupAt!
                        .toLocal()
                        .toString()
                        .substring(0, 16),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final now = DateTime.now();
                final date = await showDatePicker(
                  context: context,
                  firstDate: now,
                  lastDate: now.add(const Duration(days: 7)),
                  initialDate: now,
                );
                if (date == null || !context.mounted) return;
                final time = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay.fromDateTime(
                    now.add(const Duration(hours: 1)),
                  ),
                );
                if (time == null || !context.mounted) return;
                setState(() {
                  _scheduledPickupAt = DateTime(
                    date.year,
                    date.month,
                    date.day,
                    time.hour,
                    time.minute,
                  );
                });
              },
            ),
            const SizedBox(height: 16),
          ],

          const GuestSectionHeader(title: 'Payment method', emoji: '💳'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: (MediaQuery.sizeOf(context).width -
                        GuestSpacing.page * 2 -
                        16) /
                    3,
                child: _payMethodCard(
                  value: _PayMethod.upi,
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'UPI',
                  hint: 'GPay · PhonePe',
                  expanded: false,
                ),
              ),
              SizedBox(
                width: (MediaQuery.sizeOf(context).width -
                        GuestSpacing.page * 2 -
                        16) /
                    3,
                child: _payMethodCard(
                  value: _PayMethod.card,
                  icon: Icons.credit_card_rounded,
                  label: 'Card',
                  hint: 'Debit / Credit',
                  expanded: false,
                ),
              ),
              SizedBox(
                width: (MediaQuery.sizeOf(context).width -
                        GuestSpacing.page * 2 -
                        16) /
                    3,
                child: _payMethodCard(
                  value: _PayMethod.wallet,
                  icon: Icons.savings_outlined,
                  label: 'Wallet',
                  hint: 'Paytm · Others',
                  expanded: false,
                ),
              ),
              if (_enablePayAtCounter)
                SizedBox(
                  width: (MediaQuery.sizeOf(context).width -
                          GuestSpacing.page * 2 -
                          8) /
                      2,
                  child: _payMethodCard(
                    value: _PayMethod.payAtCounter,
                    icon: Icons.storefront_outlined,
                    label: 'Pay at counter',
                    hint: 'Settle in person',
                    expanded: false,
                  ),
                ),
              if (_enablePayToWaiter)
                SizedBox(
                  width: (MediaQuery.sizeOf(context).width -
                          GuestSpacing.page * 2 -
                          8) /
                      2,
                  child: _payMethodCard(
                    value: _PayMethod.payToWaiter,
                    icon: Icons.room_service_outlined,
                    label: 'Pay to waiter',
                    hint: 'Settle at table',
                    expanded: false,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),

          // ── Section 5: Offers & tip ──────────────────────────────────────
          const GuestSectionHeader(title: 'Offers & tip', emoji: '🎟️'),
          const SizedBox(height: 10),
          GuestSoftCard(
            child: Column(
              children: [
                TextField(
                  controller: _coupon,
                  decoration: InputDecoration(
                    labelText: 'Coupon code',
                    hintText: 'Enter promo code',
                    prefixIcon: const Icon(Icons.local_offer_outlined),
                    suffixIcon: Padding(
                      padding: const EdgeInsets.all(6),
                      child: FilledButton(
                        onPressed: _applyCoupon,
                        style: FilledButton.styleFrom(
                          backgroundColor: GuestColors.primaryOf(context),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(GuestSpacing.radiusSm),
                          ),
                          minimumSize: const Size(64, 36),
                        ),
                        child: const Text('Apply',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
                      ),
                    ),
                  ),
                ),
                if (_couponDiscount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: GuestColors.primarySoftOf(context),
                        borderRadius:
                            BorderRadius.circular(GuestSpacing.radiusSm),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_rounded,
                              size: 16, color: GuestColors.primaryOf(context)),
                          const SizedBox(width: 8),
                          Text(
                            'Saved ₹${_couponDiscount.toStringAsFixed(0)}',
                            style: TextStyle(
                              color: GuestColors.primaryDeepOf(context),
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                TextField(
                  controller: _tip,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Add a tip (₹)',
                    hintText: '0',
                    prefixIcon: Icon(Icons.favorite_outline),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Bill summary ─────────────────────────────────────────────────
          const GuestSectionHeader(title: 'Bill summary', emoji: '🧾'),
          const SizedBox(height: 10),
          GuestSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _billRow('Subtotal',
                    '₹${cart.subtotal.toStringAsFixed(0)}'),
                if (_couponDiscount > 0)
                  _billRow('Coupon discount',
                      '-₹${_couponDiscount.toStringAsFixed(0)}'),
                if (_pointsDiscount > 0)
                  _billRow('Points discount',
                      '-₹${_pointsDiscount.toStringAsFixed(0)}'),
                if (deliveryFee > 0)
                  _billRow('Delivery fee',
                      '₹${deliveryFee.toStringAsFixed(0)}'),
                if (tip > 0)
                  _billRow('Tip', '₹${tip.toStringAsFixed(0)}'),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(color: GuestColors.border),
                ),
                _billRow(
                  'Grand total',
                  '₹${total.toStringAsFixed(0)}',
                  bold: true,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.lock_outline,
                        size: 13, color: GuestColors.muted),
                    const SizedBox(width: 4),
                    Text(
                      'Secure & encrypted payment',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: GuestColors.muted,
                          ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .errorContainer
                      .withValues(alpha: 0.3),
                  borderRadius:
                      BorderRadius.circular(GuestSpacing.radiusSm),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),

          const SizedBox(height: 24),

          // ── CTAs ─────────────────────────────────────────────────────────
          GuestPillButton(
            label: _payMethod == _PayMethod.payAtCounter
                ? 'Place order · Pay at counter'
                : _payMethod == _PayMethod.payToWaiter
                    ? 'Place order · Pay to waiter'
                    : 'Pay ₹${total.toStringAsFixed(0)}',
            subtitle: _payMethod == _PayMethod.payAtCounter ||
                    _payMethod == _PayMethod.payToWaiter
                ? 'No online payment required'
                : 'Secure & Encrypted',
            icon: _payMethod == _PayMethod.payAtCounter ||
                    _payMethod == _PayMethod.payToWaiter
                ? Icons.receipt_long_rounded
                : Icons.lock_rounded,
            loading: _loading,
            onPressed: _loading ? null : _place,
          ),
        ],
      ),
    );
  }
}

// ─── Delivery time option tile ───────────────────────────────────────────────
class _DeliveryTimeOption extends StatelessWidget {
  const _DeliveryTimeOption({
    required this.icon,
    required this.label,
    required this.hint,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? GuestColors.primarySoftOf(context) : GuestColors.borderLight,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          border: Border.all(
            color: selected ? GuestColors.primaryOf(context) : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                color: selected ? GuestColors.primaryOf(context) : GuestColors.muted,
                size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color:
                          selected ? GuestColors.primaryOf(context) : GuestColors.ink,
                    ),
                  ),
                  Text(
                    hint,
                    style: const TextStyle(
                        fontSize: 12, color: GuestColors.muted),
                  ),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle_rounded,
                  color: GuestColors.primaryOf(context), size: 20),
          ],
        ),
      ),
    );
  }
}
