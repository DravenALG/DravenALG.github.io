
document.addEventListener('DOMContentLoaded', function() {
    const img = document.querySelector('.personal_img');

    img.addEventListener('mouseover', function() {
        img.src = 'images/myself2.png';
    });

    img.addEventListener('mouseout', function() {
        img.src = 'images/myself.jpg';
    });
});