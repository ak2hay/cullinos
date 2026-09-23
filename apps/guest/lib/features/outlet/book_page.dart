import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_soft_card.dart';

class BookPage extends ConsumerStatefulWidget {
  const BookPage({
    super.key,
    this.orgSlug,
    this.outletSlug,
    this.inviteToken,
  });

  final String? orgSlug;
  final String? outletSlug;
  final String? inviteToken;

  @override
  ConsumerState<BookPage> createState() => _BookPageState();
}

class _BookPageState extends ConsumerState<BookPage> {
  String? _orgSlug;
  String? _outletSlug;
  String _outletName = '';
  String _date = DateTime.now().toIso8601String().substring(0, 10);
  int _partySize = 2;
  String? _slotStart;
  List<Map<String, dynamic>> _slots = [];
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _loading = false;
  bool _slotsLoading = false;
  String? _error;
  Map<String, dynamic>? _done;

  @override
  void initState() {
    super.initState();
    _orgSlug = widget.orgSlug;
    _outletSlug = widget.outletSlug;
    _boot();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    final invite = widget.inviteToken;
    if (invite != null && invite.isNotEmpty) {
      try {
        final data = await ref.read(guestApiProvider).reservationInvite(invite);
        if (!mounted) return;
        setState(() {
          _orgSlug = data['orgSlug'] as String?;
          _outletSlug = data['outletSlug'] as String?;
          _outletName = (data['outletName'] as String?) ?? '';
          _nameCtrl.text = (data['customerName'] as String?) ?? '';
          _phoneCtrl.text = (data['customerPhone'] as String?) ?? '';
          _emailCtrl.text = (data['customerEmail'] as String?) ?? '';
        });
      } catch (e) {
        if (!mounted) return;
        setState(() => _error = friendlyApiError(e));
        return;
      }
    }
    await _loadSlots();
  }

  Future<void> _loadSlots() async {
    final org = _orgSlug;
    final outlet = _outletSlug;
    if (org == null || outlet == null) return;
    setState(() {
      _slotsLoading = true;
      _error = null;
    });
    try {
      final data = await ref.read(guestApiProvider).reservationSlots(
            orgSlug: org,
            outletSlug: outlet,
            date: _date,
            partySize: _partySize,
          );
      final raw = (data['slots'] as List?) ?? [];
      final slots = raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((s) => s['available'] == true)
          .toList();
      if (!mounted) return;
      setState(() {
        _outletName = (data['outletName'] as String?) ?? _outletName;
        _slots = slots;
        _slotStart = null;
        _slotsLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _slotsLoading = false;
        _error = friendlyApiError(e);
        _slots = [];
      });
    }
  }

  Future<void> _submit() async {
    final slot = _slotStart;
    if (slot == null) {
      setState(() => _error = 'Select a slot');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref.read(guestApiProvider).bookReservation(
            orgSlug: widget.inviteToken == null ? _orgSlug : null,
            outletSlug: widget.inviteToken == null ? _outletSlug : null,
            inviteToken: widget.inviteToken,
            customerName: _nameCtrl.text.trim(),
            customerPhone: _phoneCtrl.text.trim(),
            customerEmail: _emailCtrl.text.trim(),
            partySize: _partySize,
            reservedAt: slot,
          );
      if (!mounted) return;
      setState(() {
        _done = result;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = friendlyApiError(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done != null) {
      final when = DateTime.tryParse((_done!['reservedAt'] ?? '').toString());
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        appBar: AppBar(title: const Text('Booked')),
        body: Padding(
          padding: const EdgeInsets.all(GuestSpacing.page),
          child: GuestSoftCard(
            child: Text(
              'Reservation at ${_done!['outletName'] ?? _outletName}'
              '${when != null ? ' on ${when.toLocal()}' : ''}. '
              'Confirmation will be sent by SMS/email when available.',
            ),
          ),
        ),
      );
    }

    if ((_orgSlug == null || _outletSlug == null) &&
        (widget.inviteToken == null || widget.inviteToken!.isEmpty)) {
      return Scaffold(
        backgroundColor: GuestColors.scaffold,
        appBar: AppBar(title: const Text('Reserve')),
        body: const Padding(
          padding: EdgeInsets.all(GuestSpacing.page),
          child: Text('Open a restaurant booking or invitation link to reserve.'),
        ),
      );
    }

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        title: Text(_outletName.isEmpty ? 'Reserve a table' : 'Reserve · $_outletName'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(GuestSpacing.page),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: GuestSpacing.section),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          Text('Date', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 90)),
              );
              if (picked == null) return;
              setState(() {
                _date = picked.toIso8601String().substring(0, 10);
              });
              await _loadSlots();
            },
            child: GuestSoftCard(child: Text(_date)),
          ),
          const SizedBox(height: GuestSpacing.section),
          Text('Party size', style: Theme.of(context).textTheme.labelLarge),
          Row(
            children: [
              IconButton(
                onPressed: _partySize <= 1
                    ? null
                    : () async {
                        setState(() => _partySize -= 1);
                        await _loadSlots();
                      },
                icon: const Icon(Icons.remove_circle_outline),
              ),
              Text('$_partySize', style: Theme.of(context).textTheme.titleLarge),
              IconButton(
                onPressed: () async {
                  setState(() => _partySize += 1);
                  await _loadSlots();
                },
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          const SizedBox(height: GuestSpacing.section),
          Text('Available slot', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          if (_slotsLoading)
            const Center(child: CircularProgressIndicator())
          else if (_slots.isEmpty)
            const Text('No open slots for this date.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _slots.map((s) {
                final start = s['startAt'] as String? ?? '';
                final selected = start == _slotStart;
                final label = DateTime.tryParse(start)?.toLocal();
                final time = label == null
                    ? start
                    : TimeOfDay.fromDateTime(label).format(context);
                return ChoiceChip(
                  label: Text(time),
                  selected: selected,
                  onSelected: (_) => setState(() => _slotStart = start),
                );
              }).toList(),
            ),
          const SizedBox(height: GuestSpacing.section),
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: GuestSpacing.section),
          TextField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Phone'),
          ),
          const SizedBox(height: GuestSpacing.section),
          TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email (optional)'),
          ),
          const SizedBox(height: 24),
          GuestPillButton(
            label: _loading ? 'Booking…' : 'Confirm reservation',
            onPressed: _loading ? null : _submit,
          ),
        ],
      ),
    );
  }
}
