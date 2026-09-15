
function checkoutPage(config) {
  return {
    prodotti: config.prodotti || [],
    totaleIniziale: Number(config.totaleIniziale) || 0,
    tempoAttesa: Number(config.tempoAttesa) || 0,
    carte: config.carteSalvate || [],
    idRistorante: config.idRistorante || '',

    cartaSelezionata: config.carteSalvate.length > 0 ? 0 : 'nuova',
    nuovaCartaForm: config.carteSalvate.length === 0,
    nuovaCarta: { num_carta: '', scadenza: '', CVV: '' },

    invioInCorso: false,
    erroreGenerico: null,
    messaggioSuccesso: null,

    get isValidForm() {
      if (this.cartaSelezionata === 'nuova') {
        if (!this.nuovaCarta.num_carta || !this.nuovaCarta.scadenza || !this.nuovaCarta.CVV) {
          return false;
        }
      } else if (this.cartaSelezionata === null || this.cartaSelezionata === undefined) {
        return false;
      }

      return true;
    },

    async inviaOrdine() {
      if (!this.isValidForm || this.invioInCorso) return;

      this.invioInCorso = true;
      this.erroreGenerico = null;
      this.messaggioSuccesso = null;

      const payload = {
        listaProdotti: this.prodotti,
        totale: this.totaleIniziale,
        tempoAttesa: this.tempoAttesa,
        idRistorante: this.idRistorante
      };

      try {
        const res = await fetch('/invia-ordine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Si è verificato un errore durante l'invio dell'ordine.");

        const data = await res.json();

        this.messaggioSuccesso = "Ordine effettuato correttamente. Reindirizzamento alla home...";

        setTimeout(() => {
          window.location.href = data.redirectUrl || '/';
        }, 3000);

      } catch (err) {
        this.erroreGenerico = err.message;
        this.invioInCorso = false;
      }
    }
  };
}
