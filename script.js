const navbar = document.getElementById('navbar');
const navbarMenu = document.getElementById('navbarMenu');
const navbarPhone = document.getElementById('navbarPhone');
const navbarToggle = document.getElementById('navbarToggle');
const bookingForm = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const floatingBooking = document.getElementById('floatingBooking');
const navLinks = [...navbarMenu.querySelectorAll('a')];

function toggleNav() {
  navbarMenu.classList.toggle('is-open');
  navbarPhone.classList.toggle('is-open');
  const expanded = navbarToggle.getAttribute('aria-expanded') === 'true';
  navbarToggle.setAttribute('aria-expanded', String(!expanded));
}

navbarToggle.addEventListener('click', toggleNav);

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (navbarMenu.classList.contains('is-open')) {
      toggleNav();
    }
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 24) {
    navbar.style.background = 'rgba(30, 31, 35, 0.95)';
    navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.08)';
  } else {
    navbar.style.background = 'rgba(30, 31, 35, 0.85)';
    navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.04)';
  }
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  },
  {
    threshold: 0.4,
  }
);

document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));

bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(bookingForm);
  const description = formData.get('description');
  const name = formData.get('name');
  const phone = formData.get('phone');

  if (!description || !name || !phone) {
    formMessage.textContent = 'Заполните все поля формы.';
    formMessage.style.display = 'block';
    formMessage.style.color = '#ffb300';
    return;
  }

  formMessage.textContent = 'Спасибо! Мы свяжемся с вами в течение 15 минут.';
  formMessage.style.display = 'block';
  formMessage.style.color = 'var(--primary)';
  bookingForm.reset();
});

floatingBooking.addEventListener('click', () => {
  const descriptionField = document.getElementById('serviceDescription');
  descriptionField.focus();
  descriptionField.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

