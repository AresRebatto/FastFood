function ordiniRistorante() {
  return {
    ordini: [],
    showHistory: false,
    loadingId: null,

    init() {
      this.ordini = JSON.parse(document.getElementById('ordini-data').textContent);

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
    },

    async confermaRitiro(idOrdine) {
      this.loadingId = idOrdine;

      try {
        const res = await fetch('/conferma-ordine', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ idOrdine })
        });

        if (!res.ok) {
          throw new Error('Errore durante la conferma dell\'ordine');
        }

        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Si è verificato un errore nel confermare il ritiro. Riprova.');
      } finally {
        this.loadingId = null;
      }
    }
  };
}