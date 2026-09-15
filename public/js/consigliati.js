function consigliati() {
  return {
    items: [],

    init() {
      try {
        this.items = JSON.parse(document.getElementById('ejs-consigliati-data').textContent);
      } catch (err) {
        console.error('Errore nel parsing dei dati consigliati:', err);
        this.items = [];
      }
    },

    scroll(direction) {
      const track = this.$refs.track;
      track.scrollBy({ left: direction * 240, behavior: 'smooth' });
    }
  };
}