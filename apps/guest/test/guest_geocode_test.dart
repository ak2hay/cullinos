import 'package:flutter_test/flutter_test.dart';
import 'package:geocoding_platform_interface/geocoding_platform_interface.dart';
import 'package:cullinos_guest/features/location/guest_geocode.dart';

void main() {
  test('formatAreaSectorLabel prefers sector + city', () {
    final p = Placemark(
      subLocality: 'Koramangala',
      locality: 'Bengaluru',
      administrativeArea: 'Karnataka',
    );
    expect(formatAreaSectorLabel(p), 'Koramangala, Bengaluru');
  });

  test('formatAreaSectorLabel falls back to locality', () {
    final p = Placemark(locality: 'Pune', administrativeArea: 'Maharashtra');
    expect(formatAreaSectorLabel(p), 'Pune');
  });
}
