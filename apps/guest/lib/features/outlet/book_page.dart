import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cullinos_guest/core/friendly_api_error.dart';
import 'package:cullinos_guest/core/guest_colors.dart';
import 'package:cullinos_guest/core/guest_spacing.dart';
import 'package:cullinos_guest/data/guest_api.dart';
import 'package:cullinos_guest/widgets/guest_pill_button.dart';
import 'package:cullinos_guest/widgets/guest_section_header.dart';
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
  int _slotMinutes = 60;
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
          .toList();
      final minutes = (data['reservationSlotMinutes'] as num?)?.toInt() ??
          (data['slotMinutes'] as num?)?.toInt() ??
          60;
      if (!mounted) return;
      setState(() {
        _outletName = (data['outletName'] as String?) ?? _outletName;
        _slots = slots;
        _slotMinutes = minutes > 0 ? minutes : 60;
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

  String _formatDateLabel(String ymd) {
    final dt = DateTime.tryParse(ymd);
    if (dt == null) return ymd;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
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
          child: Text(
              'Open a restaurant booking or invitation link to reserve.'),
        ),
      );
    }

    final primary = GuestColors.primaryOf(context);

    return Scaffold(
      backgroundColor: GuestColors.scaffold,
      appBar: AppBar(
        title: Text(
            _outletName.isEmpty ? 'Reserve a table' : 'Reserve · $_outletName'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(GuestSpacing.page),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: GuestSpacing.section),
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),

          // ── Date ────────────────────────────────────────────────────────
          const GuestSectionHeader(title: 'Date', emoji: '📅'),
          const SizedBox(height: 8),
          InkWell(
            borderRadius: BorderRadius.circular(GuestSpacing.radiusMd),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 90)),
                builder: (ctx, child) {
                  return Theme(
                    data: Theme.of(ctx).copyWith(
                      colorScheme: Theme.of(ctx).colorScheme.copyWith(
                            primary: primary,
                          ),
                    ),
                    child: child!,
                  );
                },
              );
              if (picked == null) return;
              setState(() {
                _date = picked.toIso8601String().substring(0, 10);
              });
              await _loadSlots();
            },
            child: GuestSoftCard(
              child: Row(
                children: [
                  Icon(Icons.calendar_month_rounded, color: primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _formatDateLabel(_date),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  const Icon(Icons.edit_calendar_outlined,
                      color: GuestColors.muted, size: 20),
                ],
              ),
            ),
          ),

          const SizedBox(height: GuestSpacing.section),

          // ── Party ───────────────────────────────────────────────────────
          const GuestSectionHeader(title: 'Party size', emoji: '👥'),
          const SizedBox(height: 8),
          GuestSoftCard(
            child: Row(
              children: [
                IconButton(
                  onPressed: _partySize <= 1
                      ? null
                      : () async {
                          setState(() => _partySize -= 1);
                          await _loadSlots();
                        },
                  icon: const Icon(Icons.remove_circle_outline),
                  color: primary,
                ),
                Expanded(
                  child: Text(
                    '$_partySize ${_partySize == 1 ? 'guest' : 'guests'}',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                IconButton(
                  onPressed: () async {
                    setState(() => _partySize += 1);
                    await _loadSlots();
                  },
                  icon: const Icon(Icons.add_circle_outline),
                  color: primary,
                ),
              ],
            ),
          ),

          const SizedBox(height: GuestSpacing.section),

          // ── Slots ───────────────────────────────────────────────────────
          GuestSectionHeader(
            title: 'Time slots',
            emoji: '🕐',
            subtitle: '$_slotMinutes min slots · green available · amber full',
          ),
          const SizedBox(height: 10),
          if (_slotsLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(color: GuestColors.primary),
              ),
            )
          else if (_slots.isEmpty)
            const GuestSoftCard(
              child: Text(
                'No slots for this date. Try another day.',
                style: TextStyle(color: GuestColors.muted),
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _slots.map((s) {
                final start = s['startAt'] as String? ?? '';
                final available = s['available'] == true;
                final selected = start == _slotStart;
                final label = DateTime.tryParse(start)?.toLocal();
                final time = label == null
                    ? start
                    : TimeOfDay.fromDateTime(label).format(context);

                Color bg;
                Color border;
                Color fg;
                if (selected) {
                  bg = primary;
                  border = primary;
                  fg = Colors.white;
                } else if (available) {
                  bg = const Color(0xFFDCFCE7);
                  border = const Color(0xFF86EFAC);
                  fg = const Color(0xFF166534);
                } else {
                  bg = const Color(0xFFFEF3C7);
                  border = const Color(0xFFFCD34D);
                  fg = const Color(0xFF92400E);
                }

                return GestureDetector(
                  onTap: available
                      ? () => setState(() => _slotStart = start)
                      : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius:
                          BorderRadius.circular(GuestSpacing.radiusSm),
                      border: Border.all(color: border, width: 1.5),
                    ),
                    child: Text(
                      time,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: fg,
                        decoration:
                            available ? null : TextDecoration.lineThrough,
                        decorationColor: fg.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),

          const SizedBox(height: GuestSpacing.section),

          // ── Details ─────────────────────────────────────────────────────
          const GuestSectionHeader(title: 'Your details', emoji: '✏️'),
          const SizedBox(height: 8),
          GuestSoftCard(
            child: Column(
              children: [
                TextField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email (optional)',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          GuestPillButton(
            label: _loading ? 'Booking…' : 'Confirm reservation',
            onPressed: _loading ? null : _submit,
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
