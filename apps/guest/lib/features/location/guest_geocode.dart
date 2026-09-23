import 'package:geocoding/geocoding.dart';

/// Result of reverse-geocoding a coordinate for discovery + address forms.
class GuestPlaceLabel {
  const GuestPlaceLabel({
    required this.shortLabel,
    this.line1,
    this.line2,
    this.city,
    this.state,
    this.pincode,
  });

  /// Chip label, e.g. "Koramangala, Bengaluru".
  final String shortLabel;
  final String? line1;
  final String? line2;
  final String? city;
  final String? state;
  final String? pincode;
}

/// Prefer sublocality / locality for area + sector labels.
String formatAreaSectorLabel(Placemark p) {
  final sector = (p.subLocality ?? '').trim();
  final area = (p.locality ?? p.subAdministrativeArea ?? '').trim();
  final admin = (p.administrativeArea ?? '').trim();

  if (sector.isNotEmpty && area.isNotEmpty && sector.toLowerCase() != area.toLowerCase()) {
    return '$sector, $area';
  }
  if (sector.isNotEmpty) return sector;
  if (area.isNotEmpty) return area;
  if (admin.isNotEmpty) return admin;
  final thoroughfare = (p.thoroughfare ?? '').trim();
  if (thoroughfare.isNotEmpty) return thoroughfare;
  return 'Current location';
}

GuestPlaceLabel placeLabelFromPlacemark(Placemark p) {
  final streetParts = [
    p.street,
    p.subThoroughfare,
    p.thoroughfare,
  ]
      .whereType<String>()
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
  final line1 = streetParts.isNotEmpty
      ? streetParts.first
      : ((p.name ?? '').trim().isNotEmpty ? p.name!.trim() : null);
  final line2 = [
    p.subLocality,
  ]
      .whereType<String>()
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .join(', ');

  return GuestPlaceLabel(
    shortLabel: formatAreaSectorLabel(p),
    line1: line1,
    line2: line2.isEmpty ? null : line2,
    city: (p.locality ?? p.subAdministrativeArea)?.trim().isNotEmpty == true
        ? (p.locality ?? p.subAdministrativeArea)!.trim()
        : null,
    state: (p.administrativeArea ?? '').trim().isNotEmpty
        ? p.administrativeArea!.trim()
        : null,
    pincode: (p.postalCode ?? '').trim().isNotEmpty ? p.postalCode!.trim() : null,
  );
}

Future<GuestPlaceLabel?> reverseGeocodeLabel(double lat, double lng) async {
  try {
    final marks = await Geocoding().placemarkFromCoordinates(lat, lng);
    if (marks.isEmpty) return null;
    return placeLabelFromPlacemark(marks.first);
  } catch (_) {
    return null;
  }
}
