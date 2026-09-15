function profiloPage() {
	return {
		// Stato dati personali
		nome: '',
		cognome: '',
		nomeOriginale: '',
		cognomeOriginale: '',

		// Stato password
		mostraCampiPassword: false,
		passwordVisibile: false,
		nuovaPassword: '',
		confermaPassword: '',

		// Stato carte
		carte: [],
		carteOriginali: '[]',

		// Stato invio ed eliminazione
		invioInCorso: false,
		mostraConfermaEliminazione: false,
		eliminazioneInCorso: false,
		messaggioSuccesso: '',
		messaggioErrore: '',

		init() {
			const dati = JSON.parse(document.getElementById('dati-profilo-iniziali').textContent);

			this.nome = dati.nome || '';
			this.cognome = dati.cognome || '';
			this.nomeOriginale = this.nome;
			this.cognomeOriginale = this.cognome;

			this.carte = (dati.metodiPagamento || []).map(c => this.normalizzaCarta(c));
			this.carteOriginali = JSON.stringify(this.carte.map(c => this.datiConfrontabiliCarta(c)));

			this.carte.forEach(c => this.validaCarta(c));
		},

		normalizzaCarta(carta) {
			return {
				id: carta.id ?? null,
				_chiave: carta.id ? `db-${carta.id}` : `nuova-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				numero_carta: carta.numero_carta || '',
				scadenza: carta.scadenza || '',
				cvv: carta.cvv || '',
				cvvVisibile: false,
				errori: {}
			};
		},

		datiConfrontabiliCarta(carta) {
			return {
				id: carta.id,
				numero_carta: carta.numero_carta,
				scadenza: carta.scadenza,
				cvv: carta.cvv
			};
		},

		// ---------- Circuito carta ----------
		circuito(numero) {
			if (!numero) return null;
			const primaCifra = numero.charAt(0);
			if (primaCifra === '3') return 'amex';
			if (primaCifra === '4' || primaCifra === '5') return 'visa-mc';
			return 'sconosciuto';
		},

		etichettaCircuito(numero) {
			const circuito = this.circuito(numero);
			if (circuito === 'amex') return 'American Express';
			if (circuito === 'visa-mc') return numero.charAt(0) === '4' ? 'Visa' : 'Mastercard';
			if (circuito === 'sconosciuto') return 'Circuito non supportato';
			return '';
		},

		// ---------- Formattazione input ----------
		formattaNumeroCarta(carta) {
			carta.numero_carta = (carta.numero_carta || '').replace(/\D/g, '').slice(0, 16);
			this.validaCarta(carta);
		},

		formattaScadenza(carta) {
			let valore = (carta.scadenza || '').replace(/\D/g, '').slice(0, 4);
			if (valore.length >= 3) {
				valore = valore.slice(0, 2) + '/' + valore.slice(2);
			}
			carta.scadenza = valore;
			this.validaCarta(carta);
		},

		formattaCvv(carta) {
			const lunghezzaMax = this.circuito(carta.numero_carta) === 'amex' ? 4 : 3;
			carta.cvv = (carta.cvv || '').replace(/\D/g, '').slice(0, lunghezzaMax);
			this.validaCarta(carta);
		},

		// ---------- Validazione carta ----------
		validaCarta(carta) {
			const errori = {};
			const numero = carta.numero_carta || '';
			const scadenza = carta.scadenza || '';
			const cvv = carta.cvv || '';
			const circuito = this.circuito(numero);

			if (!numero) {
				errori.numero = 'Inserisci il numero della carta.';
			} else if (!/^\d+$/.test(numero)) {
				errori.numero = 'Il numero della carta deve contenere solo cifre.';
			} else if (circuito === 'sconosciuto') {
				errori.numero = 'Circuito non supportato: sono accettate solo Visa, Mastercard e American Express.';
			} else if (circuito === 'amex' && numero.length !== 15) {
				errori.numero = 'Le carte American Express hanno 15 cifre.';
			} else if (circuito === 'visa-mc' && numero.length !== 16) {
				errori.numero = 'Visa e Mastercard hanno 16 cifre.';
			}

			if (!scadenza) {
				errori.scadenza = 'Inserisci la scadenza.';
			} else if (!/^\d{2}\/\d{2}$/.test(scadenza)) {
				errori.scadenza = 'Formato non valido, usa MM/AA.';
			} else {
				const [mese, anno] = scadenza.split('/').map(Number);
				const oggi = new Date();
				const annoCorrente = oggi.getFullYear() % 100;
				const meseCorrente = oggi.getMonth() + 1;
				if (mese < 1 || mese > 12) {
					errori.scadenza = 'Il mese inserito non è valido.';
				} else if (anno < annoCorrente || (anno === annoCorrente && mese < meseCorrente)) {
					errori.scadenza = 'La carta risulta scaduta.';
				}
			}

			if (!cvv) {
				errori.cvv = 'Inserisci il CVV.';
			} else {
				const lunghezzaAttesa = circuito === 'amex' ? 4 : 3;
				if (!/^\d+$/.test(cvv) || cvv.length !== lunghezzaAttesa) {
					errori.cvv = `Il CVV deve avere ${lunghezzaAttesa} cifre per questo circuito.`;
				}
			}

			carta.errori = errori;
			return Object.keys(errori).length === 0;
		},

		// ---------- Gestione lista carte ----------
		aggiungiCarta() {
			this.carte.push(this.normalizzaCarta({}));
		},

		rimuoviCarta(chiave) {
			this.carte = this.carte.filter(c => c._chiave !== chiave);
		},

		toggleCvv(chiave) {
			const carta = this.carte.find(c => c._chiave === chiave);
			if (carta) carta.cvvVisibile = !carta.cvvVisibile;
		},

		// ---------- Stato complessivo del form ----------
		get carteConfrontabili() {
			return this.carte.map(c => this.datiConfrontabiliCarta(c));
		},

		get modificato() {
			const nomeCambiato = this.nome !== this.nomeOriginale;
			const cognomeCambiato = this.cognome !== this.cognomeOriginale;
			const passwordCambiata = this.nuovaPassword.length > 0;
			const carteCambiate = JSON.stringify(this.carteConfrontabili) !== this.carteOriginali;
			return nomeCambiato || cognomeCambiato || passwordCambiata || carteCambiate;
		},

		get passwordValida() {
			if (!this.nuovaPassword && !this.confermaPassword) return true;
			if (this.nuovaPassword.length < 8) return false;
			return this.nuovaPassword === this.confermaPassword;
		},

		get carteValide() {
			return this.carte.every(c => this.validaCarta(c));
		},

		get formValido() {
			return this.passwordValida && this.carteValide;
		},

		async inviaModifiche() {
			if (!this.modificato || !this.formValido || this.invioInCorso) return;

			this.invioInCorso = true;
			this.messaggioErrore = '';
			this.messaggioSuccesso = '';

			const corpo = {
				nome: this.nome,
				cognome: this.cognome,
				metodi_pagamento: this.carteConfrontabili
			};
			if (this.nuovaPassword) {
				corpo.password = this.nuovaPassword;
			}

			try {
				const risposta = await fetch('/modifica-dati', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(corpo)
				});

				if (!risposta.ok) throw new Error('Richiesta non riuscita');

				this.nomeOriginale = this.nome;
				this.cognomeOriginale = this.cognome;
				this.carteOriginali = JSON.stringify(this.carteConfrontabili);
				this.nuovaPassword = '';
				this.confermaPassword = '';
				this.mostraCampiPassword = false;
				this.messaggioSuccesso = 'Modifiche applicate con successo.';
			} catch (errore) {
				this.messaggioErrore = 'Non è stato possibile applicare le modifiche. Riprova.';
			} finally {
				this.invioInCorso = false;
			}
		},

		// ---------- Eliminazione Profilo ----------
		async eliminaProfilo() {
			if (this.eliminazioneInCorso) return;

			this.eliminazioneInCorso = true;
			this.messaggioErrore = '';
			this.messaggioSuccesso = '';

			try {
				const risposta = await fetch('/cancella-profilo', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' }
				});

				if (!risposta.ok) throw new Error('Cancellazione non riuscita');

				// Redireziona alla home o alla pagina di login a cancellazione avvenuta
				window.location.href = '/';
			} catch (errore) {
				this.messaggioErrore = 'Impossibile eliminare il profilo al momento. Riprova più tardi.';
				this.mostraConfermaEliminazione = false;
			} finally {
				this.eliminazioneInCorso = false;
			}
		}
	};
}