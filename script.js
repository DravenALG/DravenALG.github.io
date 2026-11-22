document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    watchGitHubStars();
    loadGitHubStars(document);

    // Load all sections
    const sections = [
        { id: 'selectedPublications', url: 'sections/publications_selected.html' },
        { id: 'fullPublications', url: 'sections/publications_full.html' },
        { id: 'teaching-section', url: 'sections/teaching.html' },
        { id: 'services-section', url: 'sections/services.html' },
        { id: 'awards-section', url: 'sections/awards.html' },
        { id: 'projects-section', url: 'sections/projects.html' }
    ];

    sections.forEach(section => loadSection(section.id, section.url));
    window.addEventListener('hashchange', revealPublicationYear);
});

// The mobile menu keeps normal anchor navigation and keyboard focus intact.
function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const navigation = document.getElementById('primary-navigation');
    const header = document.querySelector('.fixed-header');
    if (!toggle || !navigation || !header) return;

    function setOpen(open) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.querySelector('.nav-toggle-label').textContent = open ? 'Close' : 'Menu';
        navigation.dataset.open = String(open);
    }

    toggle.hidden = false;
    document.body.classList.add('navigation-ready');
    toggle.addEventListener('click', () => {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    navigation.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || toggle.getAttribute('aria-expanded') !== 'true') return;
        setOpen(false);
        const destination = document.getElementById(link.hash.slice(1));
        if (destination) {
            destination.setAttribute('tabindex', '-1');
            destination.focus({ preventScroll: true });
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            toggle.focus();
        }
    });
    document.addEventListener('click', event => {
        if (!header.contains(event.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 761px)').addEventListener('change', () => setOpen(false));
}

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
            loadGitHubStars(element);
            if (elementId === 'fullPublications') {
                initPublicationArchive(element);
                revealPublicationYear();
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
        if (badge.dataset.githubStarsLoaded === 'true' || badge.dataset.githubStarsLoading === 'true') return;

        badge.dataset.githubStarsLoading = 'true';

        fetchGitHubStarCount(repo)
            .then(count => setGitHubStarCount(badge, countElement, count))
            .catch(error => {
                console.error(`Error loading GitHub stars for ${repo}:`, error);
                countElement.textContent = 'Stars';
                badge.classList.add('github-stars-unavailable');
            })
            .finally(() => {
                delete badge.dataset.githubStarsLoading;
                badge.dataset.githubStarsLoaded = 'true';
            });
    });
}

function watchGitHubStars() {
    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
            loadGitHubStars(document);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function fetchGitHubStarCount(repo) {
    return fetch(`https://api.github.com/repos/${repo}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (typeof data.stargazers_count !== 'number') {
                throw new Error('GitHub API response missing stargazers_count');
            }
            return data.stargazers_count;
        })
        .catch(apiError => fetchShieldsStarCount(repo).catch(() => {
            throw apiError;
        }));
}

function fetchShieldsStarCount(repo) {
    return fetch(`https://img.shields.io/github/stars/${repo}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Shields API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => parseStarCount(data.message));
}

function setGitHubStarCount(badge, countElement, count) {
    countElement.textContent = formatStarCount(count);
    badge.setAttribute('aria-label', `${count} GitHub stars`);
    badge.classList.remove('github-stars-unavailable');
}

function formatStarCount(count) {
    if (typeof count !== 'number') return 'Stars';
    if (count < 1000) return count.toString();

    const formatted = (count / 1000).toFixed(count < 10000 ? 1 : 0);
    return `${formatted.replace(/\.0$/, '')}k`;
}

function parseStarCount(value) {
    if (typeof value !== 'string') {
        throw new Error('Invalid star count');
    }

    const normalized = value.trim().toLowerCase().replace(/,/g, '');
    const match = normalized.match(/^([\d.]+)\s*([km]?)$/);
    if (!match) {
        throw new Error(`Invalid star count: ${value}`);
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) {
        throw new Error(`Invalid star count: ${value}`);
    }

    const multiplier = match[2] === 'm' ? 1000000 : match[2] === 'k' ? 1000 : 1;
    return Math.round(amount * multiplier);
}

// Native details elements keep each year independently collapsible.
function initPublicationArchive(archive) {
    archive.addEventListener('click', function(event) {
        const actionButton = event.target.closest('[data-publication-action]');
        if (actionButton) {
            const expand = actionButton.dataset.publicationAction === 'expand';
            // Use the latest available year if this year's papers are not listed yet.
            const currentYear = archive.querySelector(`#publications-${new Date().getFullYear()}`)
                || archive.querySelector('.publication-year');
            archive.querySelectorAll('.publication-year').forEach(year => {
                year.open = expand || year === currentYear;
            });
            return;
        }

        const yearLink = event.target.closest('.publication-year-nav a');
        if (yearLink) {
            const year = document.getElementById(yearLink.hash.slice(1));
            if (year) year.open = true;
        }
    });
}

// Support direct links even though the full list is loaded asynchronously.
function revealPublicationYear() {
    if (!/^#publications-\d{4}$/.test(window.location.hash)) return;

    const year = document.getElementById(window.location.hash.slice(1));
    if (!year || !year.matches('.publication-year')) return;

    showFullList(false);
    year.open = true;
    year.scrollIntoView({ block: 'start' });
}

// Publications toggle function
function showFullList(expandAll = true) {
    const shouldMoveFocus = document.activeElement === document.getElementById('showFullListBtn');
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'block';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline-flex';
    if (shouldMoveFocus) document.getElementById('showSelectedListBtn').focus();

    if (expandAll) {
        document.querySelectorAll('#fullPublications .publication-year').forEach(year => {
            year.open = true;
        });
    }

    document.getElementById('publication-title').textContent = 'All publications';
}

function showSelectedList() {
    const shouldMoveFocus = document.activeElement === document.getElementById('showSelectedListBtn');
    document.getElementById('selectedPublications').style.display = 'block';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline-flex';
    document.getElementById('showSelectedListBtn').style.display = 'none';
    if (shouldMoveFocus) document.getElementById('showFullListBtn').focus();

    document.getElementById('publication-title').textContent = 'Selected publications';
}
