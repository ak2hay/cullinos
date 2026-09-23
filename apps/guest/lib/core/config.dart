/// Flavor-specific bootstrap.
library;

class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.apiBaseUrl,
    required this.appName,
  });

  final String flavor;
  final String apiBaseUrl;
  final String appName;

  static late AppConfig current;
}
