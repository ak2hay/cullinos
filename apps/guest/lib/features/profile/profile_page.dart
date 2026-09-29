import 'dart:convert';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cullinos_guest/core/firebase/guest_firestore_service.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/location/map_pin_page.dart';
import 'package:cullinos_guest/features/outlet/active_outlet_controller.dart';
import 'package:cullinos_guest/widgets/guest_avatar_greeting.dart';
import 'package:cullinos_guest/widgets/guest_back_button.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  List<dynamic> _addresses = [];
  List<dynamic> _favorites = [];
  Map<String, dynamic>? _prefs;
  bool _loading = true;
  int _membershipCount = 0;
  int _totalLoyaltyPts = 0;
  int _coinsBalance = 0;
  int _orderCount = 0;
  String? _photoUrl;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _formatPhone(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.length >= 12 && digits.startsWith('91')) {
      return '+91 ${digits.substring(2)}';
    }
    if (digits.length == 10) return '+91 $digits';
    if (raw.startsWith('+')) return raw;
    return '+$digits';
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(guestApiProvider);
      final auth = ref.read(authControllerProvider);
      try {
        final me = await api.me();
        await auth.updateProfileFields(
          name: me['name']?.toString(),
          email: me['email']?.toString() ?? '',
        );
      } catch (_) {}
      final addresses = await api.addresses();
      List<dynamic> favs = [];
      Map<String, dynamic>? prefs;
      var membershipCount = 0;
      var totalPts = 0;
      var coins = 0;
      var orderCount = 0;
      try {
        favs = await api.favoriteOutlets();
      } catch (_) {}
      try {
        prefs = await api.notificationPrefs();
      } catch (_) {}
      try {
        final memberships = await api.memberships();
        membershipCount = memberships.length;
        for (final raw in memberships) {
          final r = Map<String, dynamic>.from(raw as Map);
          totalPts += (r['loyaltyPoints'] as num?)?.toInt() ?? 0;
        }
      } catch (_) {}
      try {
        final c = await api.coins();
        coins = (c['balance'] as num?)?.toInt() ??
            (c['coins'] as num?)?.toInt() ??
            0;
      } catch (_) {}
      try {
        final orders = await api.orders();
        orderCount = orders.length;
      } catch (_) {}
      String? photoUrl;
      try {
        final uid = FirebaseAuth.instance.currentUser?.uid ??
            ref.read(authControllerProvider).guestId;
        if (uid != null && uid.isNotEmpty) {
          final profile =
              await ref.read(guestFirestoreServiceProvider).fetchProfile(uid);
          photoUrl = profile?.photoUrl ??
              FirebaseAuth.instance.currentUser?.photoURL;
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _addresses = addresses;
        _favorites = favs;
        _prefs = prefs;
        _membershipCount = membershipCount;
        _totalLoyaltyPts = totalPts;
        _coinsBalance = coins;
        _orderCount = orderCount;
        _photoUrl = photoUrl;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setProfilePicture() async {
    if (_uploadingPhoto) return;
    final uid = FirebaseAuth.instance.currentUser?.uid ??
        ref.read(authControllerProvider).guestId;
    if (uid == null || uid.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to set a profile picture.')),
      );
      return;
    }

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: GuestColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      setState(() => _uploadingPhoto = true);
      final url = await ref.read(guestFirestoreServiceProvider).uploadProfilePhoto(
            uid: uid,
            file: File(picked.path),
          );
      if (!mounted) return;
      setState(() {
        _photoUrl = url;
        _uploadingPhoto = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile picture updated'),
          backgroundColor: GuestColors.primary,
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadingPhoto = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyApiError(e))),
      );
    }
  }

  Future<void> _editProfile() async {
    final auth = ref.read(authControllerProvider);
    final nameCtrl = TextEditingController(text: auth.name ?? '');
    final emailCtrl = TextEditingController(text: auth.email ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: GuestColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
        ),
        title: const Text('Edit profile'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Name',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email (optional)',
                prefixIcon: Icon(Icons.email_outlined),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: GuestColors.primary,
            ),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final updated = await ref.read(guestApiProvider).updateMe(
            name: nameCtrl.text.trim(),
            email: emailCtrl.text.trim(),
          );
      await auth.updateProfileFields(
        name: updated['name']?.toString() ?? nameCtrl.text.trim(),
        email: updated['email']?.toString() ?? emailCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated'),
            backgroundColor: GuestColors.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyApiError(e))),
        );
      }
    }
  }

  Future<void> _editAddress([Map<String, dynamic>? existing]) async {
    final line1 = TextEditingController(text: existing?['line1']?.toString());
    final line2 = TextEditingController(text: existing?['line2']?.toString());
    final pincode =
        TextEditingController(text: existing?['pincode']?.toString());
    final city = TextEditingController(text: existing?['city']?.toString());
    final state = TextEditingController(text: existing?['state']?.toString());
    final line1Focus = FocusNode();
    final line2Focus = FocusNode();
    final pincodeFocus = FocusNode();
    final cityFocus = FocusNode();
    final stateFocus = FocusNode();
    var isDefault = existing?['isDefault'] == true ||
        (existing == null && _addresses.isEmpty);
    bool pincodeLoading = false;
    String? formError;
    double? pinLat = (existing?['latitude'] as num?)?.toDouble() ??
        (existing?['lat'] as num?)?.toDouble();
    double? pinLng = (existing?['longitude'] as num?)?.toDouble() ??
        (existing?['lng'] as num?)?.toDouble();
    String? pinLabel;

    InputDecoration fieldDecoration(String label, {Widget? suffix}) {
      return InputDecoration(
        labelText: label,
        filled: true,
        fillColor: GuestColors.scaffold,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          borderSide: const BorderSide(color: GuestColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          borderSide: const BorderSide(color: GuestColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          borderSide: const BorderSide(color: GuestColors.primary, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        counterText: '',
        suffixIcon: suffix,
      );
    }

    Future<void> onPincodeBlur(StateSetter setLocal) async {
      final pin = pincode.text.trim();
      if (!RegExp(r'^\d{6}$').hasMatch(pin)) return;
      if (city.text.isNotEmpty && state.text.isNotEmpty) return;
      setLocal(() => pincodeLoading = true);
      try {
        final uri = Uri.parse('https://api.postalpincode.in/pincode/$pin');
        final httpClient = HttpClient();
        final request = await httpClient.getUrl(uri);
        final response = await request.close();
        final body = await response.transform(utf8.decoder).join();
        final data = jsonDecode(body) as List<dynamic>;
        final po = (data[0] as Map<String, dynamic>?)?['PostOffice'];
        if (po is List && po.isNotEmpty) {
          final first = po[0] as Map<String, dynamic>;
          if (city.text.isEmpty) {
            city.text = first['District']?.toString() ?? '';
          }
          if (state.text.isEmpty) {
            state.text = first['State']?.toString() ?? '';
          }
        }
      } catch (_) {
      } finally {
        setLocal(() => pincodeLoading = false);
      }
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          backgroundColor: GuestColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
          ),
          titlePadding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
          contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                existing == null ? 'Add address' : 'Edit address',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Used for delivery checkout',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: GuestColors.muted,
                ),
              ),
              const SizedBox(height: 10),
              const Divider(height: 1, color: GuestColors.border),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                OutlinedButton.icon(
                  onPressed: () async {
                    final result = await ctx.push<Object?>(
                      '/location/map?returnResult=1',
                    );
                    if (result is! MapPinResult) return;
                    setLocal(() {
                      pinLat = result.lat;
                      pinLng = result.lng;
                      pinLabel = result.label;
                      final place = result.place;
                      if (place != null) {
                        if (line1.text.trim().isEmpty &&
                            (place.line1 ?? '').isNotEmpty) {
                          line1.text = place.line1!;
                        }
                        if (line2.text.trim().isEmpty &&
                            (place.line2 ?? '').isNotEmpty) {
                          line2.text = place.line2!;
                        }
                        if (city.text.trim().isEmpty &&
                            (place.city ?? '').isNotEmpty) {
                          city.text = place.city!;
                        }
                        if (state.text.trim().isEmpty &&
                            (place.state ?? '').isNotEmpty) {
                          state.text = place.state!;
                        }
                        if (pincode.text.trim().isEmpty &&
                            (place.pincode ?? '').isNotEmpty &&
                            RegExp(r'^\d{6}$').hasMatch(place.pincode!)) {
                          pincode.text = place.pincode!;
                        }
                      }
                    });
                  },
                  icon: const Icon(Icons.map_rounded, size: 18),
                  label: Text(
                    pinLat != null && pinLng != null
                        ? (pinLabel ?? 'Pin set — tap to change')
                        : 'Pick on map',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: GuestColors.primary,
                    side: const BorderSide(color: GuestColors.border),
                    minimumSize: const Size(double.infinity, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(GuestSpacing.radiusSm),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: line1,
                  focusNode: line1Focus,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) => line2Focus.requestFocus(),
                  decoration: fieldDecoration('Address line 1 *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: line2,
                  focusNode: line2Focus,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) => pincodeFocus.requestFocus(),
                  decoration: fieldDecoration('Address line 2'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: pincode,
                  focusNode: pincodeFocus,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) => cityFocus.requestFocus(),
                  decoration: fieldDecoration(
                    'Pincode *',
                    suffix: pincodeLoading
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: GuestColors.primary,
                              ),
                            ),
                          )
                        : null,
                  ),
                  onChanged: (v) {
                    if (v.length == 6) onPincodeBlur(setLocal);
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: city,
                        focusNode: cityFocus,
                        textInputAction: TextInputAction.next,
                        onSubmitted: (_) => stateFocus.requestFocus(),
                        decoration: fieldDecoration('City'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: state,
                        focusNode: stateFocus,
                        textInputAction: TextInputAction.done,
                        decoration: fieldDecoration('State'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Default address',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Prefill this on delivery checkout',
                    style: TextStyle(fontSize: 11, color: GuestColors.muted),
                  ),
                  value: isDefault,
                  activeThumbColor: GuestColors.primary,
                  onChanged: (v) => setLocal(() => isDefault = v),
                ),
                if (formError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        formError!,
                        style: TextStyle(
                          color: Theme.of(ctx).colorScheme.error,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (line1.text.trim().isEmpty) {
                  setLocal(() => formError = 'Address line 1 is required.');
                  line1Focus.requestFocus();
                  return;
                }
                final pin = pincode.text.trim();
                if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
                  setLocal(
                      () => formError = 'Enter a valid 6-digit pincode.');
                  pincodeFocus.requestFocus();
                  return;
                }
                Navigator.pop(ctx, true);
              },
              style: FilledButton.styleFrom(
                backgroundColor: GuestColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
                ),
              ),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    line1Focus.dispose();
    line2Focus.dispose();
    pincodeFocus.dispose();
    cityFocus.dispose();
    stateFocus.dispose();
    if (ok != true) return;

    final body = <String, dynamic>{
      'line1': line1.text.trim(),
      'line2': line2.text.trim().isEmpty ? null : line2.text.trim(),
      'pincode': pincode.text.trim(),
      'city': city.text.trim().isEmpty ? null : city.text.trim(),
      'state': state.text.trim().isEmpty ? null : state.text.trim(),
      'isDefault': isDefault,
      if (pinLat != null) 'latitude': pinLat,
      if (pinLng != null) 'longitude': pinLng,
    };

    final api = ref.read(guestApiProvider);
    if (existing == null) {
      await api.createAddress(body);
    } else {
      await api.updateAddress(existing['id'].toString(), body);
    }
    await _load();
  }

  Future<void> _setDefaultAddress(String id) async {
    await ref.read(guestApiProvider).updateAddress(id, {'isDefault': true});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final active = ref.watch(activeOutletProvider).state;
    final showBack = context.canPop() || active.isActive;
    final fallback = active.isActive ? active.outletPath : '/';
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (active.isActive) context.go(active.outletPath);
      },
      child: Scaffold(
        backgroundColor: GuestColors.scaffold,
        body: SafeArea(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: GuestColors.primary),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(
                    GuestSpacing.page,
                    8,
                    GuestSpacing.page,
                    120,
                  ),
                  children: [
                    if (showBack)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GuestBackButton(fallbackPath: fallback),
                      ),
                    GuestAvatarGreeting(
                      name: auth.name?.isNotEmpty == true
                          ? auth.name!
                          : 'Guest',
                      photoUrl: _photoUrl,
                      onAvatarTap:
                          _uploadingPhoto ? null : _setProfilePicture,
                      showSetPhotoHint: true,
                      trailing: _uploadingPhoto
                          ? const SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: GuestColors.primary,
                              ),
                            )
                          : IconButton(
                              onPressed: _editProfile,
                              icon: const Icon(
                                Icons.edit_rounded,
                                color: GuestColors.primary,
                              ),
                            ),
                    ),
                    const SizedBox(height: 4),
                    if (auth.phone != null && auth.phone!.isNotEmpty)
                      Row(
                        children: [
                          const Icon(Icons.phone_outlined,
                              size: 14, color: GuestColors.muted),
                          const SizedBox(width: 6),
                          Text(
                            _formatPhone(auth.phone),
                            style: const TextStyle(
                                color: GuestColors.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    if (auth.email != null && auth.email!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(Icons.email_outlined,
                              size: 14, color: GuestColors.muted),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              auth.email!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: GuestColors.muted, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: _ProfileStatTile(
                            label: 'Orders',
                            value: '$_orderCount',
                            onTap: () => context.push('/orders'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _ProfileStatTile(
                            label: 'Loyalty',
                            value: '$_totalLoyaltyPts',
                            onTap: () => context.push('/wallets'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _ProfileStatTile(
                            label: 'Coins',
                            value: '$_coinsBalance',
                            onTap: () => context.push('/coins'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const GuestSectionHeader(title: 'Account'),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/orders'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          const Icon(Icons.receipt_long_rounded,
                              color: GuestColors.primary, size: 20),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'My orders',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Text(
                            '$_orderCount',
                            style: const TextStyle(
                                color: GuestColors.muted,
                                fontWeight: FontWeight.w600),
                          ),
                          const Icon(Icons.chevron_right,
                              color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/wallets'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          const Icon(Icons.card_giftcard_rounded,
                              color: GuestColors.primary, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Rewards & loyalty',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  _membershipCount == 0
                                      ? 'Join restaurants to earn points'
                                      : '$_membershipCount restaurants · $_totalLoyaltyPts pts',
                                  style: const TextStyle(
                                      fontSize: 12, color: GuestColors.muted),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right,
                              color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/coins'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: const BoxDecoration(
                              color: Color(0xFFDCFCE7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.monetization_on_rounded,
                              color: Color(0xFF15803D),
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Cullinos Coins',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  'Balance $_coinsBalance',
                                  style: const TextStyle(
                                      fontSize: 12, color: GuestColors.muted),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right,
                              color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/notifications'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: const Row(
                        children: [
                          Icon(Icons.notifications_none_rounded,
                              color: GuestColors.primary, size: 20),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Notifications inbox',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Icon(Icons.chevron_right, color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    GuestSectionHeader(
                      title: 'Saved addresses',
                      trailingLabel: 'Add',
                      onTrailing: () => _editAddress(),
                    ),
                    const SizedBox(height: 8),
                    if (_addresses.isEmpty)
                      const GuestSoftCard(
                        child: Row(
                          children: [
                            Icon(Icons.location_on_outlined,
                                color: GuestColors.muted),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'No addresses yet. Add one for delivery.',
                                style: TextStyle(color: GuestColors.muted),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._addresses.map((raw) {
                        final a = Map<String, dynamic>.from(raw as Map);
                        final isDefault = a['isDefault'] == true;
                        final subtitle = [
                          a['line2'],
                          a['pincode'],
                          a['city'],
                          a['state'],
                        ]
                            .where((e) => e != null && e.toString().isNotEmpty)
                            .join(' · ');
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: GuestSoftCard(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 32,
                                      height: 32,
                                      decoration: BoxDecoration(
                                        color: isDefault
                                            ? GuestColors.primarySoft
                                            : GuestColors.borderLight,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.home_outlined,
                                        size: 16,
                                        color: isDefault
                                            ? GuestColors.primary
                                            : GuestColors.muted,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        a['line1']?.toString() ?? '',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13),
                                      ),
                                    ),
                                    if (isDefault)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: GuestColors.primarySoft,
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        child: const Text(
                                          'Default',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: GuestColors.primaryDeep,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                if (subtitle.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    subtitle,
                                    style: const TextStyle(
                                        fontSize: 12, color: GuestColors.muted),
                                  ),
                                ],
                                Row(
                                  children: [
                                    TextButton(
                                      style: TextButton.styleFrom(
                                        foregroundColor: GuestColors.primary,
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      onPressed: () => _editAddress(a),
                                      child: const Text('Edit'),
                                    ),
                                    if (!isDefault)
                                      TextButton(
                                        style: TextButton.styleFrom(
                                          foregroundColor: GuestColors.primary,
                                          visualDensity: VisualDensity.compact,
                                        ),
                                        onPressed: () => _setDefaultAddress(
                                          a['id'].toString(),
                                        ),
                                        child: const Text('Set default'),
                                      ),
                                    const Spacer(),
                                    IconButton(
                                      onPressed: () async {
                                        await ref
                                            .read(guestApiProvider)
                                            .deleteAddress(a['id'].toString());
                                        await _load();
                                      },
                                      icon: const Icon(Icons.delete_outline,
                                          color: GuestColors.muted, size: 20),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    const GuestSectionHeader(
                        title: 'Saved restaurants', emoji: '❤️'),
                    const SizedBox(height: 8),
                    if (_favorites.isEmpty)
                      const GuestSoftCard(
                        child: Row(
                          children: [
                            Icon(Icons.favorite_border,
                                color: GuestColors.muted),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Heart places from their detail page.',
                                style: TextStyle(color: GuestColors.muted),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._favorites.map((raw) {
                        final f = Map<String, dynamic>.from(raw as Map);
                        final outlet =
                            Map<String, dynamic>.from(f['outlet'] as Map);
                        final org = Map<String, dynamic>.from(
                          outlet['organization'] as Map,
                        );
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: GuestSoftCard(
                            onTap: () => context.push(
                                '/o/${org['slug']}/${outlet['slug']}'),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Row(
                              children: [
                                const Icon(Icons.favorite_rounded,
                                    color: GuestColors.primary, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        org['name']?.toString() ??
                                            outlet['name']?.toString() ??
                                            '',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13),
                                      ),
                                      if (outlet['name'] != null)
                                        Text(
                                          outlet['name'].toString(),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: GuestColors.muted),
                                        ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right,
                                    color: GuestColors.muted),
                              ],
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    const GuestSectionHeader(
                        title: 'Notification settings', emoji: '🔔'),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      child: Column(
                        children: [
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            title: const Text('Order updates',
                                style: TextStyle(fontSize: 14)),
                            subtitle: const Text('Transactional messages',
                                style: TextStyle(fontSize: 12)),
                            value: _prefs?['transactionalEnabled'] != false,
                            activeThumbColor: GuestColors.primary,
                            onChanged: (v) async {
                              final prefs = await ref
                                  .read(guestApiProvider)
                                  .updateNotificationPrefs(
                                    transactionalEnabled: v,
                                  );
                              setState(() => _prefs = prefs);
                            },
                          ),
                          const Divider(
                              height: 1, color: GuestColors.borderLight),
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            title: const Text('Offers & marketing',
                                style: TextStyle(fontSize: 14)),
                            value: _prefs?['marketingEnabled'] != false,
                            activeThumbColor: GuestColors.primary,
                            onChanged: (v) async {
                              final prefs = await ref
                                  .read(guestApiProvider)
                                  .updateNotificationPrefs(
                                    marketingEnabled: v,
                                  );
                              setState(() => _prefs = prefs);
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const GuestSectionHeader(title: 'Privacy & legal'),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/privacy'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: const Row(
                        children: [
                          Icon(Icons.privacy_tip_outlined,
                              color: GuestColors.muted, size: 20),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Privacy Policy',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          Icon(Icons.chevron_right, color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () => context.push('/terms'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: const Row(
                        children: [
                          Icon(Icons.description_outlined,
                              color: GuestColors.muted, size: 20),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Terms of Service',
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          Icon(Icons.chevron_right, color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    const GuestSoftCard(
                      padding: EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline,
                              color: GuestColors.muted, size: 18),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Data export and erasure are available via Cullinos privacy controls.',
                              style: TextStyle(
                                  color: GuestColors.muted,
                                  height: 1.4,
                                  fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const GuestSectionHeader(title: 'Help & support'),
                    const SizedBox(height: 8),
                    GuestSoftCard(
                      onTap: () async {
                        final uri = Uri.parse(
                            'mailto:support@cullinos.com?subject=Cullinos%20App%20Support');
                        try {
                          await launchUrl(uri);
                        } catch (_) {}
                      },
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      child: const Row(
                        children: [
                          Icon(Icons.email_outlined,
                              color: GuestColors.primary, size: 20),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Contact support',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  'support@cullinos.com',
                                  style: TextStyle(
                                      fontSize: 12, color: GuestColors.muted),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right, color: GuestColors.muted),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Center(
                      child: Text(
                        'Version 1.0.0',
                        style: TextStyle(
                          fontSize: 12,
                          color: GuestColors.muted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    GuestPillButton(
                      label: 'Log out',
                      secondary: true,
                      icon: Icons.logout_rounded,
                      onPressed: () =>
                          ref.read(authControllerProvider).logout(),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _ProfileStatTile extends StatelessWidget {
  const _ProfileStatTile({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: GuestColors.surface,
          borderRadius: BorderRadius.circular(GuestSpacing.radiusSm),
          boxShadow: GuestSpacing.cardShadow,
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: GuestColors.primaryDeep,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: GuestColors.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
