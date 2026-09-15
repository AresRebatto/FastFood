 let initialMeals = [];
 let initialRistoranti = [];

 try {
   initialMeals = JSON.parse(document.getElementById('ejs-meals-data').textContent);
   initialRistoranti = JSON.parse(document.getElementById('ejs-ristoranti-data').textContent);
 } catch (err) {
   console.error('Errore nel parsing dei dati EJS:', err);
 }

function gestioneRistoranti() {
  return {
    ALL_MEALS: initialMeals,
    ristoranti: initialRistoranti,
    error: '',

    panelOpen: false,
    editingId: null,
    saving: false,
    formError: '',
    form: { nome: '', via: '', n_tell: '', piva: '', menu: [] },

    mealQuery: '',
    mealCategoryFilter: '',

    confirmingDeleteId: null,

    get categories() {
      return [...new Set(this.ALL_MEALS.map(m => m.strCategory))].sort();
    },

    get selectedIds() {
      return this.form.menu.map(m => m.idMeal);
    },

    get filteredMeals() {
      const q = this.mealQuery.trim().toLowerCase();
      return this.ALL_MEALS.filter(m => {
        const matchesQuery = !q || m.strMeal.toLowerCase().includes(q);
        const matchesCategory = !this.mealCategoryFilter || m.strCategory === this.mealCategoryFilter;
        return matchesQuery && matchesCategory;
      }).slice(0, 60);
    },

    openCreate() {
      this.editingId = null;
      this.form = { nome: '', via: '', n_tell: '', piva: '', menu: [] };
      this.mealQuery = '';
      this.mealCategoryFilter = '';
      this.formError = '';
      this.panelOpen = true;
    },

    openEdit(r) {
      this.editingId = r._id;
      this.form = {
        nome: r.nome,
        via: r.via,
        n_tell: r.n_tell,
        piva: r.piva,
        menu: [...(r.menu || [])]
      };
      this.mealQuery = '';
      this.mealCategoryFilter = '';
      this.formError = '';
      this.panelOpen = true;
    },

    closePanel() {
      if (this.saving) return;
      this.panelOpen = false;
    },

    toggleMeal(meal) {
      const idx = this.form.menu.findIndex(m => m.idMeal === meal.idMeal);
      if (idx === -1) {
        this.form.menu.push(meal);
      } else {
        this.form.menu.splice(idx, 1);
      }
    },

    removeMeal(idMeal) {
      this.form.menu = this.form.menu.filter(m => m.idMeal !== idMeal);
    },

    async saveRistorante() {
      this.formError = '';

      if (this.form.piva.length !== 11) {
        this.formError = 'La partita IVA deve avere 11 cifre.';
        return;
      }

      this.saving = true;
      const isEdit = !!this.editingId;
      const url = isEdit ? `/edit-ristoranti/${this.editingId}` : '/add-ristorante';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Salvataggio non riuscito.');
        }

        // Ricarica la pagina per risincronizzare tutto tramite SSR
        window.location.reload();
      } catch (err) {
        this.formError = err.message || 'Errore di rete.';
        this.saving = false;
      }
    },

    askDelete(id) {
      this.confirmingDeleteId = id;
    },

    cancelDelete() {
      this.confirmingDeleteId = null;
    },

    async confirmDelete() {
      const id = this.confirmingDeleteId;
      if (!id) return;

      try {
        const res = await fetch(`/ristoranti/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Eliminazione non riuscita.');

        // Ricarica la pagina per risincronizzare la lista dal backend
        window.location.reload();
      } catch (err) {
        this.error = err.message || 'Errore di rete.';
        this.confirmingDeleteId = null;
      }
    }
  };
}