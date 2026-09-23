import 'package:flutter_test/flutter_test.dart';
import 'package:cullinos_guest/core/deep_links.dart';

void main() {
  test('maps guest https outlet link', () {
    final loc = mapDeepLinkToLocation(
      Uri.parse('https://guest.cullinos.com/o/acme/main?table=tbl_1'),
    );
    expect(loc, '/o/acme/main?table=tbl_1');
  });

  test('maps order get-app query', () {
    final loc = mapDeepLinkToLocation(
      Uri.parse(
        'https://order.cullinos.com/get-app?org=acme&outlet=main&session=abc',
      ),
    );
    expect(loc, '/o/acme/main?session=abc');
  });

  test('maps custom scheme', () {
    final loc = mapDeepLinkToLocation(
      Uri.parse('cullinos://outlet/acme/main?table=t1'),
    );
    expect(loc, '/o/acme/main?table=t1');
  });

  test('maps web book invite link', () {
    final loc = mapDeepLinkToLocation(
      Uri.parse('https://www.cullinos.com/book?invite=abc123'),
    );
    expect(loc, '/book?invite=abc123');
  });
}
