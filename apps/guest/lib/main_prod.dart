import 'package:cullinos_guest/core/config.dart';
import 'package:cullinos_guest/main.dart';

Future<void> main() async {
  await bootstrapGuestApp(
    const AppConfig(
      flavor: 'prod',
      apiBaseUrl: String.fromEnvironment(
        'GUEST_API_BASE',
        defaultValue: 'https://api.cullinos.com/api/v1',
      ),
      appName: 'Cullinos',
    ),
  );
}
