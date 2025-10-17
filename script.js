document.addEventListener('DOMContentLoaded', function() {
    // Load all sections
    loadSection('news-section', 'sections/news.html');
    loadSection('selectedPublications', 'sections/publications_selected.html');
    loadSection('fullPublications', 'sections/publications_full.html');
    loadSection('teaching-section', 'sections/teaching.html');
    loadSection('services-section', 'sections/services.html');
    loadSection('awards-section', 'sections/awards.html');
});

// Function to load external HTML content
function loadSection(elementId, url) {
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
        })
        .catch(error => {
            console.error('Error loading section:', error);
            document.getElementById(elementId).innerHTML = '<p>Error loading content. Please refresh the page.</p>';
        });
}

// Publications toggle function
function showFullList() {
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'block';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline';

    // Update header/title/description to Full
    var pubTitle = document.getElementById('publication-title');
    var pubDesc = document.getElementById('publication-desc');
    if (pubTitle) pubTitle.textContent = 'Full Publications';
    if (pubDesc) pubDesc.textContent = 'Below are my full publications. (& means equal contribution, * refers to corresponding author.)';
}

function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';

    // Update header/title/description to Selected
    var pubTitle = document.getElementById('publication-title');
    var pubDesc = document.getElementById('publication-desc');
    if (pubTitle) pubTitle.textContent = 'Selected Publications';
    if (pubDesc) pubDesc.textContent = 'Below are my selected publications. (& means equal contribution, * refers to corresponding author.)';
}