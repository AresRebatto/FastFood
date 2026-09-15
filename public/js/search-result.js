 function handleSearch(event) {
   event.preventDefault();

   const kind = document.getElementById('searchKind').value;
   const query = document.getElementById('searchInput').value.trim();

   if (!query) return;

   const params = new URLSearchParams({ q: query });
   window.location.href = `/search-result/${kind}?${params.toString()}`;
 }

 function updatePlaceholder(kind) {
   const input = document.getElementById('searchInput');
   input.placeholder = kind === 'dishes' ? 'Cerca un piatto...' : 'Cerca un ristorante...';
 }