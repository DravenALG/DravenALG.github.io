document.addEventListener('DOMContentLoaded', function() {
    // Load all sections
    const sections = [
        { id: 'news-section', url: 'sections/news.html' },
        { id: 'selectedPublications', url: 'sections/publications_selected.html' },
        { id: 'fullPublications', url: 'sections/publications_full.html' },
        { id: 'teaching-section', url: 'sections/teaching.html' },
        { id: 'services-section', url: 'sections/services.html' },
        { id: 'awards-section', url: 'sections/awards.html' },
        { id: 'projects-section', url: 'sections/projects.html' }
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
            if (element.querySelector('[data-github-repo]')) {
                loadGitHubStars(element);
            }
        })
        .catch(error => {
            console.error(`Error loading section ${elementId}:`, error);
            element.innerHTML = '<p>Error loading content.</p>';
        });
}

// Load live GitHub star counts for badges
function loadGitHubStars(scope = document) {
    const starBadges = scope.querySelectorAll('[data-github-repo]');

    starBadges.forEach(badge => {
        const repo = badge.dataset.githubRepo;
        const countElement = badge.querySelector('.github-star-count');

        if (!repo || !countElement) return;

        fetch(`https://api.github.com/repos/${repo}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                countElement.textContent = formatStarCount(data.stargazers_count);
                badge.setAttribute('aria-label', `${data.stargazers_count} GitHub stars`);
            })
            .catch(error => {
                console.error(`Error loading GitHub stars for ${repo}:`, error);
                countElement.textContent = 'Stars';
                badge.classList.add('github-stars-unavailable');
            });
    });
}

function formatStarCount(count) {
    if (typeof count !== 'number') return 'Stars';
    if (count < 1000) return count.toString();

    const formatted = (count / 1000).toFixed(count < 10000 ? 1 : 0);
    return `${formatted.replace(/\.0$/, '')}k`;
}

// Publications toggle function
function showFullList() {
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'block';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline';

    updatePubHeader('Below are my full publications & maniscripts.');
}

function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';

    updatePubHeader('Below are my selected publications & maniscripts');
}

function updatePubHeader(desc) {
    const pubDesc = document.getElementById('publication-desc');
    if (pubDesc) pubDesc.textContent = desc;
}
