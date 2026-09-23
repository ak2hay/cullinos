import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/features/auth/auth_controller.dart';
import 'package:cullinos_guest/features/location/guest_location_controller.dart';
import 'package:cullinos_guest/features/location/nominatim_search.dart';

Future<void> showGuestLocationSheet(
  BuildContext context,
  WidgetRef ref, {
  VoidCallback? onChanged,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: GuestColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _LocationSheet(onChanged: onChanged),
  );
}

class GuestLocationChip extends ConsumerWidget {
  const GuestLocationChip({super.key, this.onChanged});

  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loc = ref.watch(guestLocationProvider).state;
    return Material(
      color: GuestColors.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => showGuestLocationSheet(context, ref, onChanged: onChanged),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: GuestColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loc.detecting)
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: GuestColors.primaryOf(context),
                  ),
                )
              else
                Icon(
                  Icons.location_on_rounded,
                  size: 16,
                  color: GuestColors.primaryOf(context),
                ),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 140),
                child: Text(
                  loc.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: GuestColors.ink,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 18,
                color: GuestColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationSheet extends ConsumerStatefulWidget {
  const _LocationSheet({this.onChanged});

  final VoidCallback? onChanged;

  @override
  ConsumerState<_LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends ConsumerState<_LocationSheet> {
  List<Map<String, dynamic>> _addresses = [];
  bool _loadingAddresses = false;
  final _searchCtrl = TextEditingController();
  List<NominatimPlace> _searchHits = [];
  bool _searching = false;
  Timer? _searchDebounce;
  String? _sheetError;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    setState(() => _loadingAddresses = true);
    try {
      final rows = await ref.read(guestApiProvider).addresses();
      setState(() {
        _addresses =
            rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingAddresses = false);
    }
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 450), () async {
      final q = value.trim();
      if (q.length < 2) {
        if (mounted) setState(() => _searchHits = []);
        return;
      }
      setState(() => _searching = true);
      try {
        final hits = await searchNominatim(q);
        if (mounted) setState(() => _searchHits = hits);
      } catch (_) {
        if (mounted) setState(() => _searchHits = []);
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  Future<void> _autoDetect() async {
    setState(() => _sheetError = null);
    final ok = await ref.read(guestLocationProvider).detectAuto();
    if (!mounted) return;
    if (ok) {
      widget.onChanged?.call();
      Navigator.pop(context);
      return;
    }
    final err = ref.read(guestLocationProvider).state.lastError;
    setState(() {
      _sheetError = err ?? 'Location permission needed to auto-detect.';
    });
    if (err != null && err.contains('Settings')) {
      // Offer OS settings when permanently denied.
      unawaited(Geolocator.openAppSettings());
    }
  }

  Future<void> _openMap() async {
    final router = GoRouter.of(context);
    final cb = widget.onChanged;
    Navigator.of(context).pop();
    final result = await router.push<Object?>('/location/map');
    if (result == true) cb?.call();
  }

  Future<void> _pickSearch(NominatimPlace place) async {
    await ref.read(guestLocationProvider).setManual(
          lat: place.lat,
          lng: place.lng,
          label: place.shortLabel ?? place.displayName.split(',').first.trim(),
        );
    widget.onChanged?.call();
    if (mounted) Navigator.pop(context);
  }

  Future<void> _pickAddress(Map<String, dynamic> a) async {
    final lat = (a['lat'] as num?)?.toDouble() ??
        (a['latitude'] as num?)?.toDouble();
    final lng = (a['lng'] as num?)?.toDouble() ??
        (a['longitude'] as num?)?.toDouble();
    final label = [
      a['line2'] ?? a['subLocality'],
      a['city'],
    ].where((e) => e != null && e.toString().trim().isNotEmpty).join(', ');
    final fallbackLabel = a['city']?.toString() ??
        a['line1']?.toString() ??
        'Saved address';

    if (lat == null || lng == null) {
      // No coords — open map to pin, then user can re-save from profile.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'This address has no map pin. Use Set on map, or edit it in Profile.',
            ),
          ),
        );
      }
      await _openMap();
      return;
    }

    await ref.read(guestLocationProvider).setManual(
          lat: lat,
          lng: lng,
          label: label.isEmpty ? fallbackLabel : label,
        );
    widget.onChanged?.call();
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final loc = ref.watch(guestLocationProvider).state;
    final maxH = MediaQuery.of(context).size.height * 0.85;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          GuestSpacing.page,
          12,
          GuestSpacing.page,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: GuestColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Choose location',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
              ),
              const SizedBox(height: 4),
              const Text(
                'We’ll show restaurants and offers near you',
                style: TextStyle(color: GuestColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _searchCtrl,
                onChanged: _onSearchChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search area, sector, landmark…',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searching
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : (_searchCtrl.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _searchHits = []);
                              },
                            )
                          : null),
                  filled: true,
                  fillColor: GuestColors.scaffold,
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusSm),
                    borderSide: const BorderSide(color: GuestColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(GuestSpacing.radiusSm),
                    borderSide: const BorderSide(color: GuestColors.border),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
              if (_sheetError != null) ...[
                const SizedBox(height: 10),
                Text(
                  _sheetError!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    if (_searchHits.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.only(top: 8, bottom: 4),
                        child: Text(
                          'Search results',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: GuestColors.muted,
                          ),
                        ),
                      ),
                      ..._searchHits.map(
                        (p) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            Icons.place_outlined,
                            color: GuestColors.primaryOf(context),
                          ),
                          title: Text(
                            p.shortLabel ??
                                p.displayName.split(',').first.trim(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: Text(
                            p.displayName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11),
                          ),
                          onTap: () => _pickSearch(p),
                        ),
                      ),
                      const Divider(height: 20),
                    ],
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: GuestColors.primarySoftOf(context),
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                        ),
                        child: loc.detecting
                            ? Padding(
                                padding: const EdgeInsets.all(10),
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: GuestColors.primaryOf(context),
                                ),
                              )
                            : Icon(
                                Icons.my_location_rounded,
                                color: GuestColors.primaryOf(context),
                              ),
                      ),
                      title: const Text(
                        'Use current location',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        loc.hasCoords
                            ? 'Current: ${loc.label}'
                            : 'Detect area / sector via GPS',
                        style: const TextStyle(fontSize: 12),
                      ),
                      onTap: loc.detecting ? null : _autoDetect,
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: GuestColors.scaffold,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                          border: Border.all(color: GuestColors.border),
                        ),
                        child: Icon(
                          Icons.map_rounded,
                          color: GuestColors.primaryOf(context),
                        ),
                      ),
                      title: const Text(
                        'Set on map',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: const Text(
                        'Drop a pin on the map',
                        style: TextStyle(fontSize: 12),
                      ),
                      onTap: _openMap,
                    ),
                    if (_loadingAddresses)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else if (_addresses.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Saved addresses',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: GuestColors.muted,
                        ),
                      ),
                      const SizedBox(height: 4),
                      ..._addresses.map((a) {
                        final label = [
                          a['line1'],
                          a['city'],
                          a['pincode'],
                        ]
                            .where(
                              (e) => e != null && e.toString().isNotEmpty,
                            )
                            .join(', ');
                        final hasPin = (a['latitude'] ?? a['lat']) != null &&
                            (a['longitude'] ?? a['lng']) != null;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            hasPin
                                ? Icons.home_rounded
                                : Icons.home_outlined,
                            color: GuestColors.primaryOf(context),
                          ),
                          title: Text(
                            label.isEmpty ? 'Saved address' : label,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          subtitle: Text(
                            hasPin ? 'Tap to use' : 'No map pin — set on map',
                            style: const TextStyle(fontSize: 11),
                          ),
                          onTap: () => _pickAddress(a),
                        );
                      }),
                    ] else ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: GuestColors.scaffold,
                          borderRadius:
                              BorderRadius.circular(GuestSpacing.radiusSm),
                          border: Border.all(color: GuestColors.border),
                        ),
                        child: const Text(
                          'No saved addresses yet. Use current location or Set on map — or add an address in Profile with a map pin.',
                          style: TextStyle(
                            fontSize: 12,
                            color: GuestColors.muted,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
