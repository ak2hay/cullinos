// INR money helpers. API menu/order item prices are integer paise.

double paiseToRupees(num? paise) => (paise ?? 0).toDouble() / 100.0;

/// Format paise as ₹X.XX (default 2 decimals).
String formatInr(num? paise, {int decimals = 2}) {
  return '₹${paiseToRupees(paise).toStringAsFixed(decimals)}';
}

/// Format a rupee amount already in major units (e.g. payment remaining).
String formatInrRupees(num? rupees, {int decimals = 2}) {
  return '₹${(rupees ?? 0).toDouble().toStringAsFixed(decimals)}';
}
