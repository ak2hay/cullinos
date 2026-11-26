export function FounderBand() {
  return (
    <section className="border-y border-border-light bg-bg-secondary">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-3 lg:px-10">
        <div>
          <h2 className="font-serif text-3xl font-medium">Built in Mumbai</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Cullinos is built in Mumbai by Rkyves. Founder Akshay Patil.
          </p>
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium">Free setup and menu upload</h3>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            New restaurants get free setup and menu upload. Send us your menu and we load it so you can start
            billing, printing KOTs, and taking online orders.
          </p>
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium">Live integrations</h3>
          <ul className="mt-4 flex flex-wrap gap-3">
            <li className="rounded-xl border border-border-light bg-bg-card px-4 py-3 text-sm font-semibold tracking-wide">
              Razorpay
            </li>
            <li className="rounded-xl border border-border-light bg-bg-card px-4 py-3 text-sm font-semibold tracking-wide">
              MSG91
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            Razorpay for payments and MSG91 for OTP and SMS — both wired in the product today.
          </p>
        </div>
      </div>
    </section>
  );
}
