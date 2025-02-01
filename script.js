
document.addEventListener('DOMContentLoaded', function() {
    const img = document.querySelector('.personal_img');

    img.addEventListener('mouseover', function() {
        img.src = 'images/myself2.png';
    });

    img.addEventListener('mouseout', function() {
        img.src = 'images/myself.jpg';
    });
});


function showFullList() {
    document.getElementById('selectedPublications').style.display = 'none';
    document.getElementById('fullPublications').style.display = 'table-row-group';
    document.getElementById('showFullListBtn').style.display = 'none';
    document.getElementById('showSelectedListBtn').style.display = 'inline';
  }
  
  function showSelectedList() {
    document.getElementById('selectedPublications').style.display = 'table-row-group';
    document.getElementById('fullPublications').style.display = 'none';
    document.getElementById('showFullListBtn').style.display = 'inline';
    document.getElementById('showSelectedListBtn').style.display = 'none';
  }