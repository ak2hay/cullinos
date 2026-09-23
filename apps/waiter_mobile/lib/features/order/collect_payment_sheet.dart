import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_waiter/core/api_client.dart';
import 'package:cullinos_waiter/core/waiter_spacing.dart';
import 'package:cullinos_waiter/data/waiter_api.dart';
import 'package:cullinos_waiter/l10n/app_localizations.dart';

Future<bool> showCollectPaymentSheet(
  BuildContext context,
  WidgetRef ref, {
  required String orderId,
  required double remaining,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _CollectPaymentSheet(
      orderId: orderId,
      remaining: remaining,
    ),
  );
  return result == true;
}

class _CollectPaymentSheet extends ConsumerStatefulWidget {
  const _CollectPaymentSheet({
    required this.orderId,
    required this.remaining,
  });

  final String orderId;
  final double remaining;

  @override
  ConsumerState<_CollectPaymentSheet> createState() =>
      _CollectPaymentSheetState();
}

class _CollectPaymentSheetState extends ConsumerState<_CollectPaymentSheet> {
  late final TextEditingController _amount;
  late Razorpay _razorpay;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(
      text: widget.remaining.toStringAsFixed(2),
    );
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaySuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPayError);
  }

  @override
  void dispose() {
    _amount.dispose();
    _razorpay.clear();
    super.dispose();
  }

  double? get _parsedAmount {
    final v = double.tryParse(_amount.text.trim());
    if (v == null || v <= 0) return null;
    return v;
  }

  Future<void> _payCash() async {
    final amount = _parsedAmount;
    if (amount == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(waiterApiProvider).payCash(
            orderId: widget.orderId,
            amount: amount,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _payOnline() async {
    final amount = _parsedAmount;
    if (amount == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final intent = await ref.read(waiterApiProvider).onlineIntent(
            orderId: widget.orderId,
            amount: amount,
          );
      final provider = intent['provider']?.toString() ?? 'razorpay';
      if (provider == 'cashfree') {
        final sessionId = intent['paymentSessionId']?.toString();
        final cfOrderId = intent['cashfreeOrderId']?.toString();
        final mode = intent['mode']?.toString() ?? 'sandbox';
        if (sessionId == null || cfOrderId == null) {
          throw Exception('Online payments are not configured.');
        }
        final host = mode == 'production'
            ? 'https://payments.cashfree.com'
            : 'https://sandbox.cashfree.com';
        final uri = Uri.parse(
          '$host/pg/view/sessions/checkout?payment_session_id=$sessionId',
        );
        final launched =
            await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched) throw Exception('Could not open checkout.');
        if (!mounted) return;
        final l10n = AppLocalizations.of(context);
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(l10n.collectPayment),
            content: Text(l10n.completeOnline),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l10n.cancel),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l10n.paidConfirm),
              ),
            ],
          ),
        );
        if (confirmed == true) {
          await ref.read(waiterApiProvider).onlineVerify({
            'orderId': widget.orderId,
            'provider': 'cashfree',
            'cashfreeOrderId': cfOrderId,
          });
          if (mounted) Navigator.pop(context, true);
        }
        return;
      }
      final keyId = intent['keyId']?.toString();
      final rzOrderId = intent['razorpayOrderId']?.toString();
      if (keyId == null || rzOrderId == null) {
        throw Exception('Online payments are not configured.');
      }
      _razorpay.open({
        'key': keyId,
        'amount': intent['amountPaise'] ?? (amount * 100).round(),
        'name': 'Cullinos',
        'description': 'Order ${widget.orderId}',
        'order_id': rzOrderId,
        'currency': 'INR',
      });
    } catch (e) {
      setState(() => _error = friendlyDioError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onPaySuccess(PaymentSuccessResponse response) async {
    try {
      await ref.read(waiterApiProvider).onlineVerify({
        'orderId': widget.orderId,
        'provider': 'razorpay',
        'razorpayOrderId': response.orderId,
        'razorpayPaymentId': response.paymentId,
        'razorpaySignature': response.signature,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyDioError(e));
    }
  }

  void _onPayError(PaymentFailureResponse response) {
    setState(() => _error = response.message ?? 'Payment failed');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        WaiterSpacing.page,
        WaiterSpacing.page,
        WaiterSpacing.page,
        WaiterSpacing.page + bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.collectPayment,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text('${l10n.amountDue}: ₹${widget.remaining.toStringAsFixed(2)}'),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: l10n.amount),
            enabled: !_busy,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _payCash,
            child: Text(l10n.confirmCash),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _busy ? null : _payOnline,
            child: Text(l10n.payOnline),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context, false),
            child: Text(l10n.cancel),
          ),
        ],
      ),
    );
  }
}
