import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Lightweight Nominatim search for area / landmark (India-biased).
class NominatimPlace {
  const NominatimPlace({
    required this.lat,
    required this.lng,
    required this.displayName,
    this.shortLabel,
  });

  final double lat;
  final double lng;
  final String displayName;
  final String? shortLabel;
}

Future<List<NominatimPlace>> searchNominatim(
  String query, {
  int limit = 8,
}) async {
  final q = query.trim();
  if (q.length < 2) return [];

  final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
    'q': q,
    'format': 'json',
    'addressdetails': '1',
    'limit': '$limit',
    'countrycodes': 'in',
  });

  final res = await http.get(
    uri,
    headers: {
      'User-Agent': 'CullinosGuest/1.0 (location-picker)',
      'Accept-Language': 'en-IN,en',
    },
  );
  if (res.statusCode != 200) return [];

  final data = jsonDecode(res.body);
  if (data is! List) return [];

  return data.map((raw) {
    final m = Map<String, dynamic>.from(raw as Map);
    final lat = double.tryParse(m['lat']?.toString() ?? '') ?? 0;
    final lng = double.tryParse(m['lon']?.toString() ?? '') ?? 0;
    final display = m['display_name']?.toString() ?? q;
    final addr = m['address'] is Map
        ? Map<String, dynamic>.from(m['address'] as Map)
        : <String, dynamic>{};
    final sector = (addr['suburb'] ??
            addr['neighbourhood'] ??
            addr['residential'] ??
            addr['quarter'] ??
            '')
        .toString()
        .trim();
    final city = (addr['city'] ??
            addr['town'] ??
            addr['village'] ??
            addr['state_district'] ??
            '')
        .toString()
        .trim();
    String? short;
    if (sector.isNotEmpty && city.isNotEmpty) {
      short = '$sector, $city';
    } else if (sector.isNotEmpty) {
      short = sector;
    } else if (city.isNotEmpty) {
      short = city;
    }
    return NominatimPlace(
      lat: lat,
      lng: lng,
      displayName: display,
      shortLabel: short,
    );
  }).where((p) => p.lat != 0 || p.lng != 0).toList();
}
