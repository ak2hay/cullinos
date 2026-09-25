import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final guestFirestoreServiceProvider = Provider<GuestFirestoreService>((ref) {
  return GuestFirestoreService();
});

class GuestProfile {
  GuestProfile({
    required this.uid,
    this.phone,
    this.email,
    this.displayName,
    this.photoUrl,
    required this.updatedAt,
  });

  final String uid;
  final String? phone;
  final String? email;
  final String? displayName;
  final String? photoUrl;
  final DateTime updatedAt;

  factory GuestProfile.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return GuestProfile(
      uid: doc.id,
      phone: data['phone'] as String?,
      email: data['email'] as String?,
      displayName: data['displayName'] as String?,
      photoUrl: data['photoUrl'] as String?,
      updatedAt: data['updatedAt'] is Timestamp
          ? (data['updatedAt'] as Timestamp).toDate()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      if (displayName != null) 'displayName': displayName,
      if (photoUrl != null) 'photoUrl': photoUrl,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}

class GuestFirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  CollectionReference<Map<String, dynamic>> get _guests =>
      _db.collection('guests');

  Future<void> upsertFromUser(User user, {String? displayName}) async {
    await _guests.doc(user.uid).set(
      {
        'phone': user.phoneNumber,
        'email': user.email,
        'displayName': displayName ?? user.displayName,
        'photoUrl': user.photoURL,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  Future<GuestProfile?> fetchProfile(String uid) async {
    final doc = await _guests.doc(uid).get();
    if (!doc.exists) return null;
    return GuestProfile.fromFirestore(doc);
  }

  Stream<GuestProfile?> watchProfile(String uid) {
    return _guests.doc(uid).snapshots().map((doc) {
      if (!doc.exists) return null;
      return GuestProfile.fromFirestore(doc);
    });
  }

  /// Uploads under `guest-profiles/{uid}/avatar.jpg` and saves [photoUrl] on GuestProfile.
  Future<String> uploadProfilePhoto({
    required String uid,
    required File file,
  }) async {
    final ref = _storage.ref().child('guest-profiles/$uid/avatar.jpg');
    await ref.putFile(
      file,
      SettableMetadata(contentType: 'image/jpeg'),
    );
    final url = await ref.getDownloadURL();
    await _guests.doc(uid).set(
      {
        'photoUrl': url,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
    return url;
  }

  Future<void> updatePhotoUrl(String uid, String photoUrl) async {
    await _guests.doc(uid).set(
      {
        'photoUrl': photoUrl,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }
}
