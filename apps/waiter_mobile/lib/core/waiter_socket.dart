import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:cullinos_waiter/core/config.dart';
import 'package:cullinos_waiter/features/auth/auth_controller.dart';

typedef WaiterSocketHandler = void Function(dynamic data);

class WaiterSocket extends ChangeNotifier {
  io.Socket? _socket;
  String? _joinedOutletId;
  final Map<String, List<WaiterSocketHandler>> _handlers = {};

  void connect(String? token) {
    disconnect();
    if (token == null || token.isEmpty) return;
    final url = AppConfig.current.wsBaseUrl;
    _socket = io.io(
      url,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    _socket!
      ..onConnect((_) {})
      ..onDisconnect((_) {})
      ..on('order.updated', (d) => _emit('order.updated', d))
      ..on('order:updated', (d) => _emit('order.updated', d))
      ..on('order.ready', (d) => _emit('order.ready', d))
      ..on('order:ready', (d) => _emit('order.ready', d))
      ..on('kot.created', (d) => _emit('kot.created', d))
      ..on('kot:created', (d) => _emit('kot.created', d))
      ..on('table.updated', (d) => _emit('table.updated', d))
      ..on('table:updated', (d) => _emit('table.updated', d))
      ..on('service_request.created', (d) => _emit('service_request.created', d))
      ..on('service_request:created', (d) => _emit('service_request.created', d))
      ..on('service_request.updated', (d) => _emit('service_request.updated', d))
      ..on('service_request:updated', (d) => _emit('service_request.updated', d))
      ..connect();
  }

  void joinOutlet(String? outletId) {
    if (_socket == null) return;
    if (_joinedOutletId != null && _joinedOutletId != outletId) {
      _socket!.emit('leave_outlet', {'outletId': _joinedOutletId});
    }
    _joinedOutletId = outletId;
    if (outletId != null) {
      _socket!.emit('join_outlet', {'outletId': outletId});
    }
  }

  void on(String event, WaiterSocketHandler handler) {
    _handlers.putIfAbsent(event, () => []).add(handler);
  }

  void off(String event, WaiterSocketHandler handler) {
    _handlers[event]?.remove(handler);
  }

  void _emit(String event, dynamic data) {
    for (final h in List.of(_handlers[event] ?? const [])) {
      h(data);
    }
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _joinedOutletId = null;
  }
}

final waiterSocketProvider = ChangeNotifierProvider<WaiterSocket>((ref) {
  final sock = WaiterSocket();
  ref.listen(authControllerProvider, (prev, next) {
    if (next.accessToken != prev?.accessToken) {
      sock.connect(next.accessToken);
      sock.joinOutlet(next.selectedOutletId);
    }
    if (next.selectedOutletId != prev?.selectedOutletId) {
      sock.joinOutlet(next.selectedOutletId);
    }
  });
  ref.onDispose(sock.disconnect);
  return sock;
});
