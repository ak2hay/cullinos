import 'package:flutter_test/flutter_test.dart';
import 'package:cullinos_guest/core/app_info.dart';

void main() {
  test('GuestAppInfo version is defined', () {
    expect(GuestAppInfo.versionCode, greaterThan(0));
    expect(GuestAppInfo.versionName, isNotEmpty);
  });
}
