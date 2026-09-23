import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cullinos_guest/features/location/guest_geocode.dart';

class GuestLocationState {
  const GuestLocationState({
    this.lat,
    this.lng,
    this.label = 'Detect location',
    this.detecting = false,
    this.lastError,
  });

  final double? lat;
  final double? lng;
  final String label;
  final bool detecting;
  final String? lastError;

  bool get hasCoords => lat != null && lng != null;

  GuestLocationState copyWith({
    double? lat,
    double? lng,
    String? label,
    bool? detecting,
    String? lastError,
    bool clearError = false,
  }) {
    return GuestLocationState(
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      label: label ?? this.label,
      detecting: detecting ?? this.detecting,
      lastError: clearError ? null : (lastError ?? this.lastError),
    );
  }
}

class GuestLocationController extends ChangeNotifier {
  GuestLocationState _state = const GuestLocationState();
  GuestLocationState get state => _state;

  static const _kLat = 'guest_loc_lat';
  static const _kLng = 'guest_loc_lng';
  static const _kLabel = 'guest_loc_label';

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_kLat);
    final lng = prefs.getDouble(_kLng);
    final label = prefs.getString(_kLabel);
    if (lat != null && lng != null) {
      _state = GuestLocationState(
        lat: lat,
        lng: lng,
        label: label?.isNotEmpty == true ? label! : 'Current location',
      );
      notifyListeners();
      // Refresh stale "Near you" labels in background.
      if (label == null ||
          label.isEmpty ||
          label == 'Near you' ||
          label == 'Current location' ||
          label == 'Detect location') {
        final place = await reverseGeocodeLabel(lat, lng);
        if (place != null && _state.lat == lat && _state.lng == lng) {
          _state = GuestLocationState(
            lat: lat,
            lng: lng,
            label: place.shortLabel,
          );
          notifyListeners();
          await persist();
        }
      }
    }
  }

  Future<void> persist() async {
    final prefs = await SharedPreferences.getInstance();
    if (_state.lat != null) await prefs.setDouble(_kLat, _state.lat!);
    if (_state.lng != null) await prefs.setDouble(_kLng, _state.lng!);
    await prefs.setString(_kLabel, _state.label);
  }

  Future<void> setManual({
    required double lat,
    required double lng,
    required String label,
  }) async {
    var resolved = label.trim();
    if (resolved.isEmpty ||
        resolved == 'Near you' ||
        resolved == 'Current location') {
      final place = await reverseGeocodeLabel(lat, lng);
      resolved = place?.shortLabel ?? 'Current location';
    }
    _state = GuestLocationState(lat: lat, lng: lng, label: resolved);
    notifyListeners();
    await persist();
  }

  /// GPS + reverse geocode. Returns false on permission/GPS failure.
  Future<bool> detectAuto() async {
    _state = _state.copyWith(detecting: true, clearError: true);
    notifyListeners();
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _state = _state.copyWith(
          detecting: false,
          lastError: 'Turn on location services, then try again.',
        );
        notifyListeners();
        return false;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) {
        _state = _state.copyWith(
          detecting: false,
          lastError: 'Location permission needed. Enable it to find restaurants near you.',
        );
        notifyListeners();
        return false;
      }
      if (permission == LocationPermission.deniedForever) {
        _state = _state.copyWith(
          detecting: false,
          lastError:
              'Location is blocked. Enable it in Settings to auto-detect your area.',
        );
        notifyListeners();
        return false;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      final place = await reverseGeocodeLabel(pos.latitude, pos.longitude);
      _state = GuestLocationState(
        lat: pos.latitude,
        lng: pos.longitude,
        label: place?.shortLabel ?? 'Near you',
        detecting: false,
      );
      notifyListeners();
      await persist();
      return true;
    } catch (_) {
      _state = _state.copyWith(
        detecting: false,
        lastError: 'Could not detect location. Try Set on map instead.',
      );
      notifyListeners();
      return false;
    }
  }
}

final guestLocationProvider =
    ChangeNotifierProvider<GuestLocationController>((ref) {
  final c = GuestLocationController();
  c.hydrate();
  return c;
});
