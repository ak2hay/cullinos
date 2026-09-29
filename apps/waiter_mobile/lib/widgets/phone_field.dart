import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cullinos_waiter/core/waiter_colors.dart';

class DialCode {
  const DialCode({required this.dial, required this.iso, required this.label});
  final String dial;
  final String iso;
  final String label;

  String get flag => isoToFlag(iso);
}

/// Regional-indicator flag emoji for a 2-letter ISO code.
String isoToFlag(String iso) {
  if (iso.length != 2) return iso;
  final upper = iso.toUpperCase();
  return String.fromCharCodes(
    upper.codeUnits.map((c) => 0x1F1E6 + c - 65),
  );
}

const kDefaultDialCode = '91';

const kDialCodes = <DialCode>[
  DialCode(dial: '91', iso: 'IN', label: 'India (+91)'),
  DialCode(dial: '971', iso: 'AE', label: 'UAE (+971)'),
  DialCode(dial: '65', iso: 'SG', label: 'Singapore (+65)'),
  DialCode(dial: '1', iso: 'US', label: 'US/CA (+1)'),
  DialCode(dial: '44', iso: 'GB', label: 'UK (+44)'),
  DialCode(dial: '61', iso: 'AU', label: 'Australia (+61)'),
  DialCode(dial: '966', iso: 'SA', label: 'Saudi (+966)'),
  DialCode(dial: '974', iso: 'QA', label: 'Qatar (+974)'),
  DialCode(dial: '968', iso: 'OM', label: 'Oman (+968)'),
  DialCode(dial: '973', iso: 'BH', label: 'Bahrain (+973)'),
  DialCode(dial: '60', iso: 'MY', label: 'Malaysia (+60)'),
  DialCode(dial: '94', iso: 'LK', label: 'Sri Lanka (+94)'),
  DialCode(dial: '977', iso: 'NP', label: 'Nepal (+977)'),
  DialCode(dial: '880', iso: 'BD', label: 'Bangladesh (+880)'),
];

/// Phone row: compact flag + dial-code picker and an expanded number field.
class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.labelText = 'Phone',
    this.hintText = 'Enter your phone number',
    this.enabled = true,
    this.onComposedChanged,
    this.onSubmitted,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String labelText;
  final String hintText;
  final bool enabled;
  final ValueChanged<String>? onComposedChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;

  static String composedDigits(String dial, String national) {
    final d = dial.replaceAll(RegExp(r'\D'), '');
    final n = national.replaceAll(RegExp(r'\D'), '');
    if (n.isEmpty) return '';
    return '$d$n';
  }

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  String _dial = kDefaultDialCode;

  void _emit(String dial, String national) {
    widget.onComposedChanged?.call(PhoneField.composedDigits(dial, national));
  }

  DialCode get _current =>
      kDialCodes.firstWhere((c) => c.dial == _dial, orElse: () => kDialCodes.first);

  Future<void> _pickDial() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final c in kDialCodes)
              ListTile(
                leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                title: Text(c.label),
                trailing: c.dial == _dial
                    ? const Icon(Icons.check_rounded, color: WaiterColors.primary)
                    : null,
                onTap: () => Navigator.of(ctx).pop(c.dial),
              ),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;
    setState(() => _dial = picked);
    _emit(picked, widget.controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(14);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.labelText.isNotEmpty) ...[
          Text(
            widget.labelText,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: WaiterColors.ink,
            ),
          ),
          const SizedBox(height: 8),
        ],
        Row(
          children: [
            Material(
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: radius,
                side: const BorderSide(color: WaiterColors.border),
              ),
              child: InkWell(
                borderRadius: radius,
                onTap: widget.enabled ? _pickDial : null,
                child: SizedBox(
                  height: 54,
                  width: 104,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_current.flag, style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 6),
                      Text(
                        '+${_current.dial}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: WaiterColors.ink,
                        ),
                      ),
                      const Icon(Icons.keyboard_arrow_down_rounded,
                          size: 20, color: WaiterColors.muted),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SizedBox(
                height: 54,
                child: TextField(
                  controller: widget.controller,
                  enabled: widget.enabled,
                  keyboardType: TextInputType.phone,
                  textInputAction: widget.textInputAction,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(15),
                  ],
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: const TextStyle(color: WaiterColors.muted, fontSize: 14),
                    prefixIcon: const Icon(Icons.phone_outlined,
                        color: WaiterColors.primary, size: 20),
                    contentPadding: const EdgeInsets.symmetric(vertical: 16),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: radius,
                      borderSide: const BorderSide(color: WaiterColors.primary, width: 1.2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: radius,
                      borderSide: const BorderSide(color: WaiterColors.primary, width: 1.8),
                    ),
                    border: OutlineInputBorder(borderRadius: radius),
                  ),
                  onChanged: (v) => _emit(_dial, v),
                  onSubmitted: (v) {
                    final composed = PhoneField.composedDigits(_dial, v);
                    widget.onSubmitted?.call(composed);
                  },
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
