import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_waiter/app.dart';
import 'package:cullinos_waiter/core/config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  AppConfig.current = const AppConfig(
    flavor: 'test',
    apiBaseUrl: 'http://localhost/api/v1',
    wsBaseUrl: 'http://localhost',
    appName: 'Cullinos Waiter',
  );

  testWidgets('app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: CullinosWaiterApp()));
    await tester.pump();
    expect(find.textContaining('Cullinos'), findsWidgets);
  });
}
