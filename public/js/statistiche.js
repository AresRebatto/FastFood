
function statisticheApp() {
  return {
    statistiche: [],
    sortBy: 'nome',

    init() {
      const raw = document.getElementById('statistiche-data').textContent;
      this.statistiche = JSON.parse(raw || '[]');
      this.applySort();
    },

    formatCurrency(value) {
      return (value || 0).toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR'
      });
    },

    applySort() {
      this.statistiche.sort((a, b) => {
        if (this.sortBy === 'ricavo') {
          return (b.ricavoMedio || 0) - (a.ricavoMedio || 0);
        }
        return (a.nomeRistorante || '').localeCompare(b.nomeRistorante || '');
      });
    }
  };
}

function restaurantChart(incassoUltimaSettimana) {
  return {
    hovered: null,
    values: incassoUltimaSettimana || {},
    days: [
      { key: 'lun', label: 'Lun' },
      { key: 'mar', label: 'Mar' },
      { key: 'mer', label: 'Mer' },
      { key: 'gio', label: 'Gio' },
      { key: 'ven', label: 'Ven' },
      { key: 'sab', label: 'Sab' },
      { key: 'dom', label: 'Dom' }
    ],

    formatCurrency(value) {
      return (value || 0).toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR'
      });
    },

    maxValue() {
      const vals = Object.values(this.values).map(v => v || 0);
      return Math.max(...vals, 1);
    },

    barHeight(dayKey) {
      const val = this.values[dayKey] || 0;
      return Math.max((val / this.maxValue()) * 100, 2);
    }
  };
}
