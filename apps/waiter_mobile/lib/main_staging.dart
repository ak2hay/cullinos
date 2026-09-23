import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/main.dart';

Future<void> main() async {
  await bootstrapWaiterApp(
    AppConfig(
      flavor: 'staging',
      apiBaseUrl: const String.fromEnvironment(
        'WAITER_API_BASE',
        defaultValue: 'https://api.cullinos.com/api/v1',
      ),
      wsBaseUrl: const String.fromEnvironment(
        'WAITER_WS_BASE',
        defaultValue: 'https://api.cullinos.com',
      ),
      appName: 'Cullinos Waiter',
      minBuildNumber: int.tryParse(
            const String.fromEnvironment('WAITER_MIN_BUILD', defaultValue: '0'),
          ) ??
          0,
    ),
  );
}
