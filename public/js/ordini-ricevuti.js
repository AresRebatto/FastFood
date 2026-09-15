function ordiniRistorante() {
  return {
    ordini: [],
    showHistory: false,

    init() {
      this.ordini = JSON.parse(document.getElementById('ordini-data').textContent);

      // Stesso countdown "spannometrico" della pagina cliente, solo per coerenza visiva.
      setInterval(() => {
        this.ordini.forEach(o => {
          if (o.stato !== 'C' && o.tempo_rimanente > 0) o.tempo_rimanente--;
        });
      }, 60000);
    },

    get ordiniFiltrati() {
      return this.showHistory
        ? this.ordini
        : this.ordini.filter(o => o.stato !== 'C');
    },

    statusLabel(stato) {
      return { O: 'Ordinato', P: 'In preparazione', '>': 'In consegna', C: 'Consegnato' }[stato] ?? stato;
    },

    statusStep(stato) {
      return { O: 0, P: 1, '>': 2, C: 3 }[stato] ?? 0;
    }
  };
}