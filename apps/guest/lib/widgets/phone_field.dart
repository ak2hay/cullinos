import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class DialCode {
  const DialCode({required this.dial, required this.iso, required this.label});
  final String dial;
  final String iso;
  final String label;
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

/// Shared phone field with country dial-code dropdown (default India +91).
/// [onComposedChanged] receives digits-only E.164 without +, e.g. 919876543210.
class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.labelText = 'Phone',
    this.enabled = true,
    this.onComposedChanged,
    this.onSubmitted,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String labelText;
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

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 92,
          child: DropdownButtonFormField<String>(
            value: _dial,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Code',
              contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 10),
              isDense: true,
            ),
            items: [
              for (final c in kDialCodes)
                DropdownMenuItem(
                  value: c.dial,
                  child: Text(
                    '${c.iso} +${c.dial}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
            ],
            onChanged: widget.enabled
                ? (v) {
                    if (v == null) return;
                    setState(() => _dial = v);
                    _emit(v, widget.controller.text);
                  }
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: TextField(
            controller: widget.controller,
            enabled: widget.enabled,
            keyboardType: TextInputType.phone,
            textInputAction: widget.textInputAction,
            style: const TextStyle(fontSize: 16, letterSpacing: 0.5),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(15),
            ],
            decoration: InputDecoration(
              labelText: widget.labelText,
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              // Dial code lives in the dropdown — do not repeat as prefixText.
            ),
            onChanged: (v) => _emit(_dial, v),
            onSubmitted: (v) {
              final composed = PhoneField.composedDigits(_dial, v);
              widget.onSubmitted?.call(composed);
            },
          ),
        ),
      ],
    );
  }
}
