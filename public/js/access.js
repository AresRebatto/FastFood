function authPage(startingMode) {
  return {
    mode: startingMode,
    loading: false,
    showLoginPassword: false,
    showSignupPassword: false,
    formError: '',

    login: { email: '', password: '', remember: false },
    signup: {
      accountType: 'customer',
      firstName: '', lastName: '', email: '',
      password: '', passwordConfirm: ''
    },
    errors: {},

    switchMode(target) {
      this.mode = target;
      this.errors = {};
      this.formError = '';
    },



    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },

    passwordScore(pw) {
      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
      if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
      return score; // 0-3
    },

    get strengthLabel() {
      const score = this.passwordScore(this.signup.password);
      return ['Debole', 'Debole', 'Media', 'Forte'][score] || 'Debole';
    },

    strengthBarStyle(index) {
      const score = this.passwordScore(this.signup.password);
      const colors = ['var(--color-error)', 'var(--color-warning)', 'var(--color-success)'];
      const active = index < Math.max(score, this.signup.password.length > 0 ? 1 : 0);
      const colorIndex = Math.max(score - 1, 0);
      return {
        background: active ? colors[colorIndex] : 'var(--color-neutral-200)'
      };
    },

    validateLogin() {
      const errors = {};
      if (!this.login.email) {
        errors.loginEmail = 'Inserisci la tua email.';
      } else if (!this.isValidEmail(this.login.email)) {
        errors.loginEmail = 'Inserisci un indirizzo email valido.';
      }
      if (!this.login.password) {
        errors.loginPassword = 'Inserisci la tua password.';
      }
      this.errors = errors;
      return Object.keys(errors).length === 0;
    },

    validateSignup() {
      const errors = {};
      if (!this.signup.firstName.trim()) errors.firstName = 'Campo obbligatorio.';
      if (!this.signup.lastName.trim()) errors.lastName = 'Campo obbligatorio.';

      if (!this.signup.email) {
        errors.email = 'Inserisci la tua email.';
      } else if (!this.isValidEmail(this.signup.email)) {
        errors.email = 'Inserisci un indirizzo email valido.';
      }

      if (!this.signup.password) {
        errors.password = 'Scegli una password.';
      } else if (this.signup.password.length < 8) {
        errors.password = 'Almeno 8 caratteri.';
      }

      if (!this.signup.passwordConfirm) {
        errors.passwordConfirm = 'Ripeti la password.';
      } else if (this.signup.passwordConfirm !== this.signup.password) {
        errors.passwordConfirm = 'Le password non coincidono.';
      }

      this.errors = errors;
      return Object.keys(errors).length === 0;
    },

    async submitLogin() {
      if (!this.validateLogin()) return;
      this.loading = true;
      this.formError = '';

      try {
        const res = await fetch(`/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.login.email,
            password: this.login.password
          })
        });

        const data = await res.json();

        if (!res.ok) {
       	switch (res.status) {
                case 401:
                  this.formError = 'Email o password errati.';
                  break;
                case 500:
                  this.formError = 'Errore del server. Riprova più tardi.';
                  break;
                default:
                  this.formError = data.Error || 'Errore durante il login.';
              }
        	return;
        }

        window.location.href = '/';

      } catch (err) {
        console.error(err);
        this.formError = 'Impossibile contattare il server. Riprova.';
      } finally {
        this.loading = false;
      }
    },

    async submitSignup() {
      if (!this.validateSignup()) return;
      this.loading = true;
      this.formError = '';

      try {
        const ruolo = this.signup.accountType === 'restaurant' ? 'R' : 'C';

        const res = await fetch(`/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.signup.email,
            nome: this.signup.firstName,
            cognome: this.signup.lastName,
            password: this.signup.password,
            ruolo: ruolo
          })
        });

        const data = await res.json();

        if (!res.ok) {
       	switch (res.status) {
                case 400:
                  // Manca un parametro o ruolo non valido - non dovrebbe succedere
                  // se validateSignup() ha già fatto il suo lavoro, ma copriamo il caso
                  this.formError = data.Error || 'Dati non validi. Controlla i campi.';
                  break;
                case 409:
                  this.formError = 'Esiste già un account con questa email.';
                  // Bonus UX: porta subito al login precompilando l'email
                  this.errors.email = 'Email già registrata.';
                  break;
                case 500:
                  this.formError = 'Errore del server. Riprova più tardi.';
                  break;
                default:
                  this.formError = data.Error || 'Errore durante la registrazione.';
              }
          return;
        }

        window.location.href = '/';

      } catch (err) {
        console.error(err);
        this.formError = 'Impossibile contattare il server. Riprova.';
      } finally {
        this.loading = false;
      }
    }

  };
}