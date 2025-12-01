document.addEventListener('DOMContentLoaded', function() {
    // Load all sections
    const sections = [
        { id: 'news-section', url: 'sections/news.html' },
        { id: 'selectedPublications', url: 'sections/publications_selected.html' },
        { id: 'fullPublications', url: 'sections/publications_full.html' },
        { id: 'teaching-section', url: 'sections/teaching.html' },
        { id: 'services-section', url: 'sections/services.html' },
        { id: 'awards-section', url: 'sections/awards.html' }
    ];

    sections.forEach(section => loadSection(section.id, section.url));
});

// Function to load external HTML content
function loadSection(elementId, url) {
    const element = document.getElementById(elementId);
    if (!element) return;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            element.innerHTML = data;
        })
        .catch(error => {
            console.error(`Error loading section ${elementId}:`, error);
            element.innerHTML = '<p>Error loading content.</p>';
        });
}

// Publications toggle function
function showFullList() {
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'block';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline';

    updatePubHeader('Full Publications', 'Below are my full publications. (& means equal contribution, * refers to corresponding author.)');
}

function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';

    updatePubHeader('Selected Publications', 'Below are my selected publications. (& means equal contribution, * refers to corresponding author.)');
}

function updatePubHeader(title, desc) {
    const pubTitle = document.getElementById('publication-title');
    const pubDesc = document.getElementById('publication-desc');
    if (pubTitle) pubTitle.textContent = title;
    if (pubDesc) pubDesc.textContent = desc;
}