function searchHero() {
  return {
    query: '',
    type: 'dishes', // Default: cerca piatti
    focused: false,
    placeholder: '',

    // Liste dinamiche per la digitazione guidata
    examplesMap: {
      dishes: [
        'cerca una pizza margherita…',
        'cerca sushi o sashimi…',
        'cerca smash burger…',
        'cerca poké al salmone…'
      ],
      restaurants: [
        'cerca Pizzeria da Michele…',
        'cerca Birrodromo…',
        'cerca Toki Sushi…'
      ]
    },

    exampleIndex: 0,
    charIndex: 0,
    deleting: false,
    timer: null,

    init() {
      this.typeAnimation();
    },

    getCurrentExamples() {
      return this.examplesMap[this.type] || this.examplesMap.dishes;
    },

    onTypeChange() {
      // Reset dell'animazione del placeholder quando si cambia tendina
      clearTimeout(this.timer);
      this.exampleIndex = 0;
      this.charIndex = 0;
      this.deleting = false;
      this.typeAnimation();
    },

    typeAnimation() {
      const examples = this.getCurrentExamples();
      const current = examples[this.exampleIndex];

      if (!this.deleting) {
        this.charIndex++;
        this.placeholder = current.slice(0, this.charIndex);
        if (this.charIndex === current.length) {
          this.deleting = true;
          this.timer = setTimeout(() => this.typeAnimation(), 1400);
          return;
        }
      } else {
        this.charIndex--;
        this.placeholder = current.slice(0, this.charIndex);
        if (this.charIndex === 0) {
          this.deleting = false;
          this.exampleIndex = (this.exampleIndex + 1) % examples.length;
        }
      }

      this.timer = setTimeout(() => this.typeAnimation(), this.deleting ? 40 : 70);
    },




    submit() {
      if (!this.query.trim()) return;

      const params = new URLSearchParams({
        q: this.query.trim(),
        type: this.type
      });

      window.location.href = `/cerca?${params.toString()}`;
    }
  };
}