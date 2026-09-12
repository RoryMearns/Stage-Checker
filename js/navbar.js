document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.navbar-burger').forEach(burger => {
        burger.addEventListener('click', () => {
            const target = document.getElementById(burger.dataset.target);
            burger.classList.toggle('is-active');
            burger.setAttribute('aria-expanded', burger.classList.contains('is-active'));
            target.classList.toggle('is-active');
        });
    });
});