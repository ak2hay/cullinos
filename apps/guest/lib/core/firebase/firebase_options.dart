import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for project `rkyves-cullinos`.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Web is not configured for Cullinos App.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyD18NW08DABhrHngPF19mTY4jh7SJhMXRk',
    appId: '1:350882778547:android:aa4faa34ed6da688394fc6',
    messagingSenderId: '350882778547',
    projectId: 'rkyves-cullinos',
    storageBucket: 'rkyves-cullinos.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDrRtgv22E83RLeP9XHVPejtKMPL529FVk',
    appId: '1:350882778547:ios:42c897589f88af8a394fc6',
    messagingSenderId: '350882778547',
    projectId: 'rkyves-cullinos',
    storageBucket: 'rkyves-cullinos.firebasestorage.app',
    iosBundleId: 'com.cullinos.cullinosGuest',
  );
}
