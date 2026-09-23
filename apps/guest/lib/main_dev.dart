import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/main.dart';

Future<void> main() async {
  await bootstrapGuestApp(
    const AppConfig(
      flavor: 'dev',
      apiBaseUrl: String.fromEnvironment(
        'GUEST_API_BASE',
        defaultValue: 'http://10.0.2.2:3000/api/v1',
      ),
      appName: 'Cullinos (Dev)',
    ),
  );
}
