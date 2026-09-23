import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/main.dart';

Future<void> main() async {
  await bootstrapWaiterApp(
    AppConfig(
      flavor: 'dev',
      apiBaseUrl: const String.fromEnvironment(
        'WAITER_API_BASE',
        defaultValue: 'http://10.0.2.2:3000/api/v1',
      ),
      wsBaseUrl: const String.fromEnvironment(
        'WAITER_WS_BASE',
        defaultValue: 'http://10.0.2.2:3000',
      ),
      appName: 'Cullinos Waiter Dev',
      minBuildNumber: int.tryParse(
            const String.fromEnvironment('WAITER_MIN_BUILD', defaultValue: '0'),
          ) ??
          0,
    ),
  );
}
