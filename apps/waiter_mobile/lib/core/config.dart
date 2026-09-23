library;

class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    required this.appName,
    this.minBuildNumber = 0,
    this.playStoreUrl =
        'https://play.google.com/store/apps/details?id=com.cullinos.waiter',
  });

  final String flavor;
  final String apiBaseUrl;
  final String wsBaseUrl;
  final String appName;
  /// When > 0 and installed buildNumber is lower, force update dialog.
  final int minBuildNumber;
  final String playStoreUrl;

  static late AppConfig current;
}
