import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/features/location/guest_geocode.dart';
import 'package:cullinos_guest/features/location/guest_location_controller.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';

/// Result returned when confirming a map pin (for profile address forms).
class MapPinResult {
  const MapPinResult({
    required this.lat,
    required this.lng,
    required this.label,
    this.place,
  });

  final double lat;
  final double lng;
  final String label;
  final GuestPlaceLabel? place;
}

/// Full-screen OSM map with fixed center pin.
///
/// Extra query: `returnResult=1` → pop with [MapPinResult] instead of only
/// updating [guestLocationProvider].
class MapPinPage extends ConsumerStatefulWidget {
  const MapPinPage({super.key, this.returnResult = false});

  final bool returnResult;

  @override
  ConsumerState<MapPinPage> createState() => _MapPinPageState();
}

class _MapPinPageState extends ConsumerState<MapPinPage> {
  static const _indiaFallback = LatLng(20.5937, 78.9629);

  final _mapController = MapController();
  LatLng _center = _indiaFallback;
  double _zoom = 5;
  GuestPlaceLabel? _place;
  String _preview = 'Move the map to set your pin';
  bool _geocoding = false;
  bool _booting = true;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _boot() async {
    final loc = ref.read(guestLocationProvider).state;
    LatLng start = _indiaFallback;
    var zoom = 5.0;

    if (loc.hasCoords) {
      start = LatLng(loc.lat!, loc.lng!);
      zoom = 16;
    } else {
      try {
        final permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.whileInUse ||
            permission == LocationPermission.always ||
            permission == LocationPermission.denied) {
          var p = permission;
          if (p == LocationPermission.denied) {
            p = await Geolocator.requestPermission();
          }
          if (p == LocationPermission.whileInUse ||
              p == LocationPermission.always) {
            final pos = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(
                accuracy: LocationAccuracy.medium,
              ),
            );
            start = LatLng(pos.latitude, pos.longitude);
            zoom = 16;
          }
        }
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _center = start;
      _zoom = zoom;
      _booting = false;
    });
    await _reverse(_center);
  }

  void _onMapEvent(MapEvent event) {
    if (event is MapEventMoveEnd ||
        event is MapEventFlingAnimationEnd ||
        event is MapEventDoubleTapZoomEnd) {
      final c = event.camera.center;
      setState(() => _center = c);
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 450), () {
        _reverse(c);
      });
    }
  }

  Future<void> _reverse(LatLng c) async {
    setState(() => _geocoding = true);
    final place = await reverseGeocodeLabel(c.latitude, c.longitude);
    if (!mounted) return;
    setState(() {
      _place = place;
      _preview = place?.shortLabel ??
          '${c.latitude.toStringAsFixed(5)}, ${c.longitude.toStringAsFixed(5)}';
      _geocoding = false;
    });
  }

  Future<void> _confirm() async {
    final label = _place?.shortLabel ?? _preview;
    if (!widget.returnResult) {
      await ref.read(guestLocationProvider).setManual(
            lat: _center.latitude,
            lng: _center.longitude,
            label: label,
          );
      if (mounted) context.pop(true);
      return;
    }
    if (mounted) {
      context.pop(
        MapPinResult(
          lat: _center.latitude,
          lng: _center.longitude,
          label: label,
          place: _place,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        backgroundColor: GuestColors.surface,
        foregroundColor: GuestColors.ink,
        elevation: 0,
        title: const Text(
          'Set location on map',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
        ),
      ),
      body: _booting
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: _center,
                          initialZoom: _zoom,
                          minZoom: 3,
                          maxZoom: 19,
                          onMapEvent: _onMapEvent,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.cullinos.guest',
                          ),
                        ],
                      ),
                      // Fixed center pin (map moves underneath)
                      IgnorePointer(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 36),
                          child: Icon(
                            Icons.location_on,
                            size: 52,
                            color: GuestColors.primaryOf(context),
                            shadows: const [
                              Shadow(
                                blurRadius: 8,
                                color: Colors.black26,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Positioned(
                        right: 16,
                        bottom: 16,
                        child: Material(
                          color: GuestColors.surface,
                          elevation: 2,
                          shape: const CircleBorder(),
                          child: IconButton(
                            tooltip: 'My location',
                            onPressed: () async {
                              final ok = await ref
                                  .read(guestLocationProvider)
                                  .detectAuto();
                              if (!ok || !mounted) return;
                              final loc =
                                  ref.read(guestLocationProvider).state;
                              if (!loc.hasCoords) return;
                              final c = LatLng(loc.lat!, loc.lng!);
                              _mapController.move(c, 16);
                              setState(() => _center = c);
                              await _reverse(c);
                            },
                            icon: Icon(
                              Icons.my_location_rounded,
                              color: GuestColors.primaryOf(context),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(
                    GuestSpacing.page,
                    14,
                    GuestSpacing.page,
                    16 + MediaQuery.of(context).padding.bottom,
                  ),
                  decoration: const BoxDecoration(
                    color: GuestColors.surface,
                    border: Border(top: BorderSide(color: GuestColors.border)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          if (_geocoding)
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: GuestColors.primaryOf(context),
                              ),
                            )
                          else
                            Icon(
                              Icons.place_rounded,
                              size: 18,
                              color: GuestColors.primaryOf(context),
                            ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _preview,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GuestPillButton(
                        label: 'Confirm location',
                        onPressed: _confirm,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
