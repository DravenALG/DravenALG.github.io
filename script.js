document.addEventListener('DOMContentLoaded', function() {
    const img = document.querySelector('.personal_img');

    img.addEventListener('mouseover', function() {
        img.src = 'images/myself2.png';
    });

    img.addEventListener('mouseout', function() {
        img.src = 'images/myself.jpg';
    });

    // Load all sections
    loadSection('news-section', 'sections/news.html');
    loadSection('selectedPublications', 'sections/publications_selected.html');
    loadSection('fullPublications', 'sections/publications_full.html');
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
}

function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';
}