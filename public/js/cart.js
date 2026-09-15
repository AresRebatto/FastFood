document.addEventListener('alpine:init', () => {
  if (!Alpine.store('cart')) {
    Alpine.store('cart', {
      items: JSON.parse(localStorage.getItem('cart') || '[]'),
      restaurantId: localStorage.getItem('cartRestaurantId') || null,
      restaurantName: localStorage.getItem('cartRestaurantName') || null,

      pendingModal: {
        show: false,
        newItem: null,
        newQty: 1,
        onSuccess: null
      },

      toast: {
        show: false,
        message: ''
      },

      showError(msg) {
        this.toast.message = msg;
        this.toast.show = true;
        setTimeout(() => {
          this.toast.show = false;
        }, 4000);
      },

      addItem(item, qty, onSuccess) {
        if (this.items.length > 0 && this.restaurantId && String(this.restaurantId) !== String(item.id)) {
          this.pendingModal.newItem = item;
          this.pendingModal.newQty = qty;
          this.pendingModal.onSuccess = onSuccess;
          this.pendingModal.show = true;
          return;
        }

        this._executeAddItem(item, qty);
        if (onSuccess) onSuccess();
      },

      confirmChange() {
        this.clear();
        this._executeAddItem(this.pendingModal.newItem, this.pendingModal.newQty);
        if (this.pendingModal.onSuccess) this.pendingModal.onSuccess();
        this.cancelChange();
      },

      cancelChange() {
        this.pendingModal.show = false;
        this.pendingModal.newItem = null;
        this.pendingModal.newQty = 1;
        this.pendingModal.onSuccess = null;
      },

      _executeAddItem(item, qty) {
        this.restaurantId = item.id;
        this.restaurantName = item.nome;

        const existing = this.items.find((i) => i.idMeal === item.idMeal);
        if (existing) {
          existing.qty += qty;
        } else {
          this.items.push({
            idMeal: item.idMeal,
            strMeal: item.strMeal,
            strMealThumb: item.strMealThumb,
            price: item.price,
            qty
          });
        }

        this._persist();
      },

      removeItem(idMeal) {
        this.items = this.items.filter((i) => i.idMeal !== idMeal);
        if (this.items.length === 0) {
          this.restaurantId = null;
          this.restaurantName = null;
        }
        this._persist();
      },

      clear() {
        this.items = [];
        this.restaurantId = null;
        this.restaurantName = null;
        this._persist();
      },

      _persist() {
        localStorage.setItem('cart', JSON.stringify(this.items));
        if (this.restaurantId) {
          localStorage.setItem('cartRestaurantId', this.restaurantId);
          localStorage.setItem('cartRestaurantName', this.restaurantName || '');
        } else {
          localStorage.removeItem('cartRestaurantId');
          localStorage.removeItem('cartRestaurantName');
        }
      },

      get totalItems() {
        return this.items.reduce((sum, i) => sum + i.qty, 0);
      }
    });
  }
});

function cartWidget() {
  return {
    open: false,
    submitting: false,

		async procedi() {
			const cart = Alpine.store('cart');
			if (!cart.items.length || this.submitting) return;

			this.submitting = true;
			try {
			  const res = await fetch('/invio-ordine', {
			    method: 'POST',
			    headers: { 'Content-Type': 'application/json' },
			    credentials: 'include',
			    body: JSON.stringify({
			      idRistorante: cart.restaurantId,
			      nomeRistorante: cart.restaurantName,
			      items: cart.items.map((i) => ({
			        idMeal: i.idMeal,
			        strMeal: i.strMeal,
			        price: i.price,
			        qty: i.qty
			      }))
			    })
			  });

			  const data = await res.json();

			  if (!res.ok) {
			    switch (res.status) {
			      case 400:
			        cart.showError(data.Error || 'Dati ordine non validi.');
			        break;
			      case 401:
			        cart.showError('Devi effettuare il login per procedere.');
			        break;
			      case 500:
			        cart.showError('Errore del server. Riprova più tardi.');
			        break;
			      default:
			        cart.showError(data.Error || "Errore durante l'invio dell'ordine.");
			    }
			    return;
			  }

			  if (data.redirectUrl) {
			    cart.clear();
			    window.location.href = data.redirectUrl;
			  } else {
			    cart.showError("Risposta inattesa dal server.");
			  }
			} catch (err) {
			  console.error(err);
			  cart.showError("Impossibile contattare il server. Riprova.");
			} finally {
			  this.submitting = false;
			}
		}
  };
}