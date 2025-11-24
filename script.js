const navbar = document.getElementById('navbar');
const navbarMenu = document.getElementById('navbarMenu');
const navbarPhone = document.getElementById('navbarPhone');
const navbarToggle = document.getElementById('navbarToggle');
const bookingForm = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const floatingBooking = document.getElementById('floatingBooking');
const navLinks = [...navbarMenu.querySelectorAll('a')];
const leadForm = document.getElementById('leadForm');
const leadPhoneInput = document.getElementById('leadPhone');
const leadFormError = document.getElementById('leadFormError');

const WEBHOOK_URL = 'https://alex87ai.ru/webhook/43498cf2-2d7e-4045-9fe1-44edd0faf7e3';

function buildWebhookEnvelope(payload, meta = {}) {
  return {
    payload,
    form: meta.form || null,
    page: meta.page || window.location.href,
    source: 'warsztat28_site',
    timestamp: new Date().toISOString()
  };
}

// Универсальная отправка на вебхук: beacon + POST (cors) + fallback (no-cors)
function dispatchWebhook(envelope, options = {}) {
  try {
    const jsonString = JSON.stringify(envelope);
    const onFinally = typeof options.onFinally === 'function' ? options.onFinally : null;
    let sent = false;

    const fallback = () => {
      if (sent) return;
      try {
        const formBody = new URLSearchParams({ payload: jsonString });
        fetch(WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: formBody.toString()
        })
          .catch(() => {})
          .finally(() => {
            if (onFinally) onFinally();
          });
      } catch (_) {
        if (onFinally) onFinally();
      }
    };

    // 1) Основная попытка: fetch с JSON телом (cors)
    try {
      fetch(WEBHOOK_URL, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json'
        },
        body: jsonString
      })
        .then((response) => {
          if (response.ok || response.status === 0) {
            sent = true;
            console.log('[Webhook] Successfully sent via fetch (CORS)');
          }
        })
        .catch((error) => {
          console.warn('[Webhook] CORS fetch failed, trying fallback:', error);
          fallback();
        })
        .finally(() => {
          if (sent && onFinally) onFinally();
        });
    } catch (error) {
      console.warn('[Webhook] Fetch error, trying fallback:', error);
      fallback();
    }

    // 2) Параллельно пытаемся через sendBeacon (не требует CORS)
    try {
      if (navigator && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const beaconSent = navigator.sendBeacon(WEBHOOK_URL, blob);
        if (beaconSent) {
          console.log('[Webhook] Sent via sendBeacon');
        }
      }
    } catch (error) {
      console.warn('[Webhook] sendBeacon failed:', error);
    }
  } catch (error) {
    console.error('[Webhook] dispatchWebhook error:', error);
    if (options.onFinally) options.onFinally();
  }
}

function sendToWebhook(payload, meta = {}) {
  const envelope = buildWebhookEnvelope(payload, meta);
  dispatchWebhook(envelope);
}

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

if (navbarMenu) {
  const navLinks = [...navbarMenu.querySelectorAll('a')];
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

  const mainSections = document.querySelectorAll('main section[id]');
  if (mainSections.length > 0) {
    mainSections.forEach((section) => observer.observe(section));
  }
}

if (bookingForm) {
  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const description = formData.get('description');
    const name = formData.get('name');
    const phone = formData.get('phone');

    if (!name || !phone) {
      if (formMessage) {
        formMessage.textContent = 'Заполните обязательные поля формы (имя и телефон).';
        formMessage.style.display = 'block';
        formMessage.style.color = '#ffb300';
      }
      return;
    }

    // Сохраняем данные заявки для отправки на вебхук на странице спасибо
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utm = {
        utm_source: urlParams.get('utm_source'),
        utm_medium: urlParams.get('utm_medium'),
        utm_campaign: urlParams.get('utm_campaign'),
        utm_term: urlParams.get('utm_term'),
        utm_content: urlParams.get('utm_content')
      };

      const payload = {
        name: String(name).trim(),
        phone: String(phone).trim(),
        description: description ? String(description).trim() : ''
      };
      const submission = {
        form: 'booking',
        payload
      };
      sessionStorage.setItem('car_service_submission', JSON.stringify(submission));

      // Мгновенная отправка вебхука до редиректа (дополнительно к отправке на thanks)
      sendToWebhook(payload, { form: submission.form });
    } catch (e) {
      // игнорируем ошибки сохранения, чтобы не мешать пользователю
    }

    // Перенаправление на страницу благодарности
    setTimeout(() => {
      window.location.href = 'thanks.html';
    }, 250);
  });
}

// Кнопка "Позвонить нам" теперь использует href="tel:..." и не требует обработчика

// Данные об услугах
const servicesData = {
  diagnostics: {
    title: 'Диагностика автомобиля',
    image: 'images/Диагностика автомобилей.jpg',
    description: `
      <p>Диагностика автомобиля — это комплекс процедур, направленных на проверку технического состояния транспортного средства. Она позволяет выявить возможные неисправности и предотвратить более серьёзные проблемы в будущем.</p>
      <h3>Виды диагностики автомобиля:</h3>
      <ol>
        <li><strong>Визуальная диагностика.</strong> Это первый этап проверки, который включает в себя осмотр автомобиля на наличие видимых повреждений, утечек жидкостей и других проблем. Визуальная диагностика помогает выявить некоторые неисправности, такие как трещины на шлангах или повреждения кузова.</li>
        <li><strong>Компьютерная диагностика.</strong> Этот метод использует специальное оборудование для проверки электронных систем автомобиля. Компьютерная диагностика позволяет выявить ошибки в работе двигателя, трансмиссии, тормозной системы и других компонентов.</li>
        <li><strong>Диагностика ходовой части.</strong> Ходовая часть автомобиля включает в себя подвеску, рулевое управление и тормозные механизмы. Диагностика ходовой части позволяет выявить износ или повреждение деталей, которые могут привести к снижению управляемости и безопасности автомобиля.</li>
        <li><strong>Диагностика двигателя.</strong> Двигатель является одним из самых важных компонентов автомобиля. Диагностика двигателя включает в себя проверку уровня масла, охлаждающей жидкости, а также компрессии в цилиндрах. Это позволяет выявить проблемы с двигателем, такие как утечка масла или перегрев.</li>
        <li><strong>Диагностика трансмиссии.</strong> Трансмиссия передаёт крутящий момент от двигателя к колёсам. Диагностика трансмиссии включает в себя проверку уровня трансмиссионной жидкости, а также работу коробки передач и сцепления. Это позволяет выявить проблемы, такие как пробуксовка сцепления или утечка трансмиссионной жидкости.</li>
        <li><strong>Диагностика электрооборудования.</strong> Электрооборудование автомобиля включает в себя аккумулятор, генератор, стартер и другие компоненты. Диагностика электрооборудования позволяет выявить проблемы с зарядкой аккумулятора, работой стартера и другими электрическими системами.</li>
        <li><strong>Проверка уровня технических жидкостей.</strong> В автомобиле есть несколько технических жидкостей, таких как моторное масло, охлаждающая жидкость, тормозная жидкость и жидкость гидроусилителя руля. Проверка уровня этих жидкостей позволяет выявить утечки и предотвратить перегрев двигателя или отказ тормозов.</li>
        <li><strong>Акустическая диагностика.</strong> Некоторые проблемы можно определить по звуку, издаваемому автомобилем при движении или работе. Например, стук в подвеске или шум двигателя могут указывать на необходимость ремонта.</li>
        <li><strong>Тест-драйв.</strong> Во время тест-драйва мастер может оценить работу автомобиля в реальных условиях, проверить управляемость, эффективность тормозной системы и выявить другие проблемы.</li>
      </ol>
      <p>Автосервис предлагает услугу комплексной диагностики автомобиля, которая включает в себя все вышеперечисленные виды проверки. После проведения диагностики мастер составляет подробный отчёт о состоянии автомобиля и даёт рекомендации по ремонту или обслуживанию.</p>
    `
  },
  oil: {
    title: 'Замена масла и фильтров',
    image: 'images/Замена масла и фильтров.png',
    description: `
      <p>Замена масла и фильтров — это одна из самых распространённых услуг, предоставляемых автосервисами. Она включает в себя несколько этапов:</p>
      <h3>Этапы замены масла и фильтров:</h3>
      <ol>
        <li><strong>Подготовка.</strong> Перед заменой масла автомобиль должен быть установлен на подъёмнике или специальной площадке, чтобы обеспечить доступ к масляному поддону двигателя. Также необходимо подготовить инструменты и расходные материалы, такие как новое масло, фильтры, прокладки и уплотнители.</li>
        <li><strong>Слив старого масла.</strong> Мастер откручивает пробку масляного поддона и сливает старое масло в специальный контейнер. Это позволяет удалить отработавшее масло и загрязнения из системы смазки двигателя.</li>
        <li><strong>Очистка масляного поддона.</strong> После слива масла мастер проверяет состояние масляного поддона на наличие повреждений или коррозии. При необходимости поддон очищается от загрязнений.</li>
        <li><strong>Установка нового фильтра.</strong> Старый масляный фильтр заменяется на новый. Фильтр играет важную роль в очистке масла от загрязнений, поэтому его регулярная замена необходима для поддержания чистоты системы смазки и продления срока службы двигателя.</li>
        <li><strong>Заливка нового масла.</strong> Новое масло заливается в двигатель через заливную горловину с помощью специального насоса или воронки. Количество масла должно соответствовать рекомендациям производителя автомобиля.</li>
        <li><strong>Проверка уровня масла.</strong> После заливки масла мастер проверяет его уровень с помощью масляного щупа. Уровень масла должен находиться между минимальной и максимальной отметками на щупе.</li>
        <li><strong>Завершение.</strong> Все процедуры по замене масла и фильтров документируются в отчёте, который предоставляется клиенту. Автомобиль опускается с подъёмника, и клиент может забрать его после завершения работ.</li>
      </ol>
      <p>Регулярная замена масла и фильтров является важной процедурой технического обслуживания автомобиля, которая помогает поддерживать его в хорошем состоянии и продлевает срок службы двигателя. Рекомендуется проводить замену масла и фильтров в соответствии с рекомендациями производителя автомобиля или чаще, если автомобиль эксплуатируется в тяжёлых условиях.</p>
    `
  },
  maintenance: {
    title: 'Техническое обслуживание',
    image: 'images/Техническое обслуживание.png',
    description: `
      <p>Техническое обслуживание (ТО) — это комплекс профилактических мероприятий, направленных на поддержание автомобиля в исправном состоянии и предотвращение возможных поломок. ТО включает в себя ряд процедур, которые необходимо проводить регулярно в соответствии с рекомендациями производителя автомобиля.</p>
      <h3>Виды технического обслуживания:</h3>
      <ol>
        <li><strong>Ежедневное ТО</strong> проводится водителем перед каждой поездкой и включает проверку уровня масла, охлаждающей жидкости, тормозной жидкости, а также контроль давления в шинах и состояния световых приборов. Это помогает выявить и устранить возможные проблемы до начала поездки.</li>
        <li><strong>Первое техническое обслуживание (ТО-1)</strong> проводится через определённое количество километров пробега (обычно каждые 5–10 тысяч километров) и включает замену масла и фильтров, проверку состояния тормозных колодок и дисков, а также осмотр подвески и рулевого управления.</li>
        <li><strong>Второе техническое обслуживание (ТО-2)</strong> проводится примерно через 15–20 тысяч километров пробега после ТО-1 и включает все процедуры ТО-1, а также более глубокую проверку всех систем автомобиля, включая двигатель, трансмиссию, электрику и ходовую часть.</li>
        <li><strong>Сезонное обслуживание</strong> проводится два раза в год при смене сезонов (осенью и весной) и включает подготовку автомобиля к эксплуатации в условиях нового сезона. Это может включать замену шин, проверку системы отопления и кондиционирования воздуха, а также замену технических жидкостей.</li>
        <li><strong>Внеплановое обслуживание</strong> проводится при возникновении неисправностей или после ДТП. Оно включает диагностику и ремонт повреждённых компонентов, а также проверку других систем автомобиля на предмет скрытых повреждений.</li>
      </ol>
      <p>Автосервис предлагает услугу комплексного технического обслуживания, которая включает все вышеперечисленные виды проверки. После проведения ТО мастер составляет подробный отчёт о состоянии автомобиля и даёт рекомендации по дальнейшему обслуживанию.</p>
      <p>Регулярное прохождение технического обслуживания помогает поддерживать автомобиль в хорошем состоянии, предотвращает поломки и увеличивает срок его службы. Рекомендуется проводить ТО в соответствии с графиком, рекомендованным производителем автомобиля, или чаще, если автомобиль эксплуатируется в тяжёлых условиях.</p>
    `
  },
  bodywork: {
    title: 'Кузовной ремонт',
    image: 'images/Кузовной ремонт.jpg',
    description: `
      <p>Кузовной ремонт — это комплекс работ, направленных на восстановление внешнего вида и геометрии кузова автомобиля после повреждений. Он может включать в себя различные процедуры в зависимости от характера и степени повреждений.</p>
      <h3>Виды кузовного ремонта:</h3>
      <ol>
        <li><strong>Устранение вмятин и царапин.</strong> Это один из самых распространённых видов кузовного ремонта. Он включает в себя выравнивание поверхности кузова с помощью специальных инструментов и приспособлений. Царапины могут быть устранены путём полировки или нанесения специального покрытия.</li>
        <li><strong>Замена или ремонт повреждённых элементов кузова.</strong> Если элемент кузова повреждён настолько, что его невозможно восстановить, он может быть заменён на новый. Это может включать замену дверей, крыльев, капотов и других деталей.</li>
        <li><strong>Восстановление геометрии кузова.</strong> Геометрия кузова может быть нарушена в результате ДТП или других происшествий. Восстановление геометрии включает в себя проверку и регулировку углов установки колёс, а также выравнивание кузова по контрольным точкам.</li>
        <li><strong>Сварка и резка металла.</strong> Сварка используется для соединения металлических деталей, а резка — для удаления повреждённых участков кузова. Эти процедуры требуют высокой квалификации и опыта работы.</li>
        <li><strong>Шпатлёвка и покраска.</strong> Шпатлёвка используется для выравнивания поверхности кузова после сварки или резки. Покраска необходима для восстановления цвета и блеска кузова. Этот процесс требует тщательной подготовки поверхности и использования качественных материалов.</li>
        <li><strong>Антикоррозийная обработка.</strong> После кузовного ремонта важно защитить кузов от коррозии. Антикоррозийная обработка включает в себя нанесение специальных составов на поверхность кузова, которые предотвращают появление ржавчины.</li>
      </ol>
      <p>Автосервис предлагает услугу комплексного кузовного ремонта, которая включает все вышеперечисленные виды работ. После проведения ремонта мастер составляет подробный отчёт о выполненных работах и даёт рекомендации по дальнейшему уходу за кузовом.</p>
      <p>Регулярное обслуживание кузова помогает предотвратить коррозию и сохранить внешний вид автомобиля. Рекомендуется проводить осмотр кузова не реже одного раза в год и при необходимости обращаться к специалистам для проведения кузовного ремонта.</p>
    `
  },
  brakes: {
    title: 'Замена тормозных систем',
    image: 'images/Замена тормозных систем.jpg',
    description: `
      <p>Замена тормозных систем — это комплекс работ, направленных на установку новых или отремонтированных компонентов тормозной системы автомобиля. Тормозная система является одной из самых важных систем автомобиля, поэтому её исправность и эффективность должны быть гарантированы.</p>
      <h3>Виды тормозных систем:</h3>
      <ol>
        <li><strong>Дисковые тормоза.</strong> Это наиболее распространённый тип тормозных систем, который используется на передних и задних колёсах большинства современных автомобилей. Дисковые тормоза состоят из тормозного диска, который вращается вместе с колесом, и тормозных колодок, которые прижимаются к диску для создания трения и остановки автомобиля. Замена дисковых тормозов включает в себя снятие старых тормозных дисков и колодок, очистку посадочных мест, установку новых компонентов и прокачку тормозной системы для удаления воздуха.</li>
        <li><strong>Барабанные тормоза.</strong> Этот тип тормозных систем используется на задних колёсах некоторых автомобилей. Барабанные тормоза состоят из барабана, который крепится к ступице колеса, и тормозных колодок, которые раздвигаются и прижимаются к барабану для создания трения. Замена барабанных тормозов включает в себя снятие старого барабана и колодок, установку нового комплекта и регулировку зазора между колодками и барабаном.</li>
        <li><strong>Тормозные суппорты и цилиндры.</strong> Суппорты и тормозные цилиндры являются важными компонентами дисковых тормозных систем. Суппорты удерживают тормозные колодки и обеспечивают их равномерное прижатие к тормозному диску. Цилиндры создают давление в тормозной системе, которое приводит в действие суппорты. Замена суппортов и цилиндров включает в себя снятие старых компонентов, установку новых и прокачку системы.</li>
        <li><strong>Антиблокировочная система (ABS).</strong> ABS является электронной системой, которая предотвращает блокировку колёс при торможении, что улучшает управляемость и безопасность автомобиля. Замена компонентов ABS включает в себя диагностику и ремонт электронного блока управления, датчиков скорости вращения колёс и других компонентов.</li>
      </ol>
      <p>Автосервис предлагает услугу комплексной замены тормозных систем, которая включает все вышеперечисленные виды работ. После проведения замены мастер составляет подробный отчёт о выполненных работах и даёт рекомендации по дальнейшему обслуживанию.</p>
      <p>Регулярная замена тормозных систем помогает предотвратить аварии и сохранить безопасность на дороге. Рекомендуется проводить осмотр тормозных систем не реже одного раза в год и при необходимости обращаться к специалистам для проведения замены.</p>
    `
  },
  transmission: {
    title: 'Ремонт трансмиссии',
    image: 'images/Ремонт трансмиссии.jpg',
    description: `
      <p>Ремонт трансмиссии — это комплекс работ, направленных на восстановление исправности и эффективности системы передачи крутящего момента от двигателя к колёсам автомобиля. Трансмиссия является одной из ключевых систем автомобиля, поэтому её надёжная работа важна для безопасности и комфорта вождения.</p>
      <h3>Виды трансмиссий:</h3>
      <ol>
        <li><strong>Механическая трансмиссия.</strong> Это наиболее распространённый тип трансмиссии, который используется в большинстве автомобилей. Она состоит из сцепления, коробки передач, карданного вала, дифференциала и полуосей. Ремонт механической трансмиссии может включать замену или ремонт сцепления, синхронизаторов, шестерён, подшипников, сальников и других компонентов.</li>
        <li><strong>Автоматическая трансмиссия.</strong> Этот тип трансмиссии использует гидротрансформатор и планетарную передачу для автоматического переключения передач. Ремонт автоматической трансмиссии может включать в себя замену или ремонт гидротрансформатора, фрикционных дисков, соленоидов, клапанов и других компонентов.</li>
        <li><strong>Роботизированная трансмиссия.</strong> Роботизированные трансмиссии сочетают в себе преимущества механических и автоматических трансмиссий. Они могут быть более экономичными и эффективными, но также могут быть подвержены сбоям и неисправностям. Ремонт роботизированной трансмиссии может включать в себя адаптацию программного обеспечения, замену или ремонт актуаторов, датчиков и других компонентов.</li>
        <li><strong>Вариаторная трансмиссия (CVT).</strong> Вариаторные трансмиссии обеспечивают плавное изменение передаточного числа без использования фиксированных передач. Ремонт вариаторной трансмиссии может включать в себя замену ремня, шкивов, конусов, подшипников и других компонентов.</li>
      </ol>
      <p>Автосервис предлагает услугу комплексного ремонта трансмиссии, которая включает все вышеперечисленные виды работ. После проведения ремонта мастер составляет подробный отчёт о выполненных работах и даёт рекомендации по дальнейшему обслуживанию.</p>
      <p>Регулярный ремонт трансмиссии помогает предотвратить серьёзные поломки и сохранить безопасность на дороге. Рекомендуется проводить осмотр трансмиссии не реже одного раза в год и при необходимости обращаться к специалистам для проведения ремонта.</p>
    `
  }
};

// Работа с модальным окном услуги
const serviceModal = document.getElementById('serviceModal');
const serviceModalClose = document.getElementById('serviceModalClose');
const serviceModalImage = document.getElementById('serviceModalImage');
const serviceModalTitle = document.getElementById('serviceModalTitle');
const serviceModalDescription = document.getElementById('serviceModalDescription');
const serviceModalConsultationBtn = document.getElementById('serviceModalConsultationBtn');
const serviceButtons = document.querySelectorAll('[data-service]');
let currentServiceId = null;

function openServiceModal(serviceId) {
  const service = servicesData[serviceId];
  if (!service) return;

  currentServiceId = serviceId;
  serviceModalImage.src = service.image;
  serviceModalImage.alt = service.title;
  serviceModalTitle.textContent = service.title;
  serviceModalDescription.innerHTML = service.description;
  
  serviceModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeServiceModal() {
  serviceModal.classList.remove('is-open');
  document.body.style.overflow = '';
}

serviceButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const serviceId = button.getAttribute('data-service');
    openServiceModal(serviceId);
  });
});

if (leadForm) {
  function validateLeadPhone(value) {
    return value.replace(/\D/g, '').length >= 8;
  }

  leadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const phone = leadPhoneInput.value.trim();

    if (!validateLeadPhone(phone)) {
      if (leadFormError) {
        leadFormError.textContent = 'Wpisz prawidłowy numer telefonu (minimum 8 cyfr).';
      }
      leadPhoneInput.focus();
      return;
    }

    if (leadFormError) {
      leadFormError.textContent = '';
    }

    // Сохраняем данные для отправки на вебхук
    try {
      const payload = {
        phone: phone
      };
      const submission = {
        form: 'lead',
        payload
      };
      sessionStorage.setItem('car_service_submission', JSON.stringify(submission));

      // Мгновенная отправка вебхука до редиректа
      sendToWebhook(payload, { form: 'lead' });
    } catch (e) {
      console.error('[Lead Form] Error saving submission:', e);
    }

    // Перенаправление на страницу благодарности
    setTimeout(() => {
      window.location.href = 'thanks.html';
    }, 250);
  });
}

serviceModalClose.addEventListener('click', closeServiceModal);

if (serviceModalConsultationBtn) {
  serviceModalConsultationBtn.addEventListener('click', () => {
    closeServiceModal();
    if (currentServiceId) {
      setTimeout(() => {
        openConsultationModal(currentServiceId);
      }, 300);
    }
  });
}

serviceModal.addEventListener('click', (e) => {
  if (e.target === serviceModal || e.target.classList.contains('service-modal__overlay')) {
    closeServiceModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (serviceModal && serviceModal.classList.contains('is-open')) {
      closeServiceModal();
    }
    if (consultationModal && consultationModal.classList.contains('is-open')) {
      if (typeof closeConsultationModal === 'function') {
        closeConsultationModal();
      }
    }
    if (reviewViewerModal && reviewViewerModal.classList.contains('is-open')) {
      closeReviewViewer();
    }
  }
});

// Работа с модальным окном консультации
const consultationModal = document.getElementById('consultationModal');
const consultationModalClose = document.getElementById('consultationModalClose');
const consultationForm = document.getElementById('consultationForm');
const consultationPhone = document.getElementById('consultationPhone');
const consultationMessage = document.getElementById('consultationMessage');
const consultationButtons = document.querySelectorAll('[data-consultation]');

// Маска телефона для польских номеров
function formatPolishPhone(value) {
  // Удаляем все кроме цифр
  let cleaned = value.replace(/\D/g, '');
  
  // Если начинается с 48, удаляем код страны
  if (cleaned.startsWith('48')) {
    cleaned = cleaned.substring(2);
  }
  
  // Ограничиваем до 9 цифр
  if (cleaned.length > 9) {
    cleaned = cleaned.substring(0, 9);
  }
  
  // Форматируем: +48 (XXX) XXX-XXX
  if (cleaned.length === 0) {
    return '+48 (';
  }
  
  let formatted = '+48 (';
  
  // Первая группа: 3 цифры
  if (cleaned.length <= 3) {
    formatted += cleaned + '___'.substring(cleaned.length);
    if (cleaned.length === 3) {
      formatted += ') ___-___';
    }
    return formatted;
  }
  
  formatted += cleaned.substring(0, 3) + ') ';
  
  // Вторая группа: 3 цифры
  if (cleaned.length <= 6) {
    formatted += cleaned.substring(3) + '___'.substring(cleaned.length - 3);
    if (cleaned.length === 6) {
      formatted += '-___';
    } else {
      formatted += '-___';
    }
    return formatted;
  }
  
  formatted += cleaned.substring(3, 6) + '-';
  
  // Третья группа: 3 цифры
  formatted += cleaned.substring(6, 9);
  
  return formatted;
}

if (consultationPhone) {
  consultationPhone.addEventListener('input', (e) => {
  const cursorPosition = e.target.selectionStart;
  const oldValue = e.target.value;
  const newValue = formatPolishPhone(e.target.value);
  
  e.target.value = newValue;
  
  // Улучшенное позиционирование курсора
  let newCursorPosition = cursorPosition;
  const digitsInOld = oldValue.replace(/\D/g, '').length;
  const digitsInNew = newValue.replace(/\D/g, '').length;
  
  if (digitsInNew > digitsInOld) {
    // Добавлена цифра
    if (digitsInNew <= 3) {
      newCursorPosition = 5 + digitsInNew; // +48 (X
    } else if (digitsInNew <= 6) {
      newCursorPosition = 10 + digitsInNew - 3; // +48 (XXX) X
    } else {
      newCursorPosition = 15 + digitsInNew - 6; // +48 (XXX) XXX-X
    }
  } else if (digitsInNew < digitsInOld) {
    // Удалена цифра
    if (digitsInNew < 3) {
      newCursorPosition = 5 + digitsInNew;
    } else if (digitsInNew < 6) {
      newCursorPosition = 10 + digitsInNew - 3;
    } else {
      newCursorPosition = 15 + digitsInNew - 6;
    }
  }
  
  e.target.setSelectionRange(newCursorPosition, newCursorPosition);
  });

  consultationPhone.addEventListener('keydown', (e) => {
  // Разрешаем удаление, навигацию и специальные клавиши
  if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
    return;
  }
  
    // Если это не цифра, блокируем
    if (!/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  });
}

if (consultationModal && consultationPhone) {
  function openConsultationModal(serviceId) {
    consultationModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    consultationPhone.value = '+48 (';
    consultationPhone.focus();
    consultationPhone.setSelectionRange(5, 5); // Устанавливаем курсор после +48 (
  }

  function closeConsultationModal() {
    consultationModal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (consultationForm) {
      consultationForm.reset();
    }
    if (consultationMessage) {
      consultationMessage.textContent = '';
      consultationMessage.style.display = 'none';
    }
  }

  consultationButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const serviceId = button.getAttribute('data-consultation');
      openConsultationModal(serviceId);
    });
  });

  // Кнопка консультации в секции цен
  const pricesConsultationBtn = document.getElementById('pricesConsultationBtn');
  if (pricesConsultationBtn) {
    pricesConsultationBtn.addEventListener('click', () => {
      openConsultationModal('prices');
    });
  }

  if (consultationModalClose) {
    consultationModalClose.addEventListener('click', closeConsultationModal);
  }

  consultationModal.addEventListener('click', (e) => {
    if (e.target === consultationModal || e.target.classList.contains('consultation-modal__overlay')) {
      closeConsultationModal();
    }
  });

  if (consultationForm) {
    consultationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const phone = consultationPhone.value.replace(/\D/g, '');
      const question = document.getElementById('consultationQuestion').value.trim();
      
      // Проверка формата телефона (должен быть 9 цифр после +48)
      const phoneDigits = phone.replace(/\D/g, '');
      if (!phoneDigits.startsWith('48')) {
        if (consultationMessage) {
          consultationMessage.textContent = 'Пожалуйста, введите корректный номер телефона.';
          consultationMessage.style.display = 'block';
          consultationMessage.style.color = '#ffb300';
        }
        return;
      }
      
      const phoneNumber = phoneDigits.substring(2); // Убираем код страны 48
      if (phoneNumber.length !== 9) {
        if (consultationMessage) {
          consultationMessage.textContent = 'Пожалуйста, введите полный номер телефона (9 цифр).';
          consultationMessage.style.display = 'block';
          consultationMessage.style.color = '#ffb300';
        }
        return;
      }
      
      // Сохраняем данные консультации для отправки на вебхук на странице спасибо
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const utm = {
          utm_source: urlParams.get('utm_source'),
          utm_medium: urlParams.get('utm_medium'),
          utm_campaign: urlParams.get('utm_campaign'),
          utm_term: urlParams.get('utm_term'),
          utm_content: urlParams.get('utm_content')
        };

        const payload = {
          phone: `+48${phoneNumber}`,
          question: question
        };
        const submission = {
          form: 'consultation',
          payload
        };
        sessionStorage.setItem('car_service_submission', JSON.stringify(submission));

        // Мгновенная отправка вебхука до редиректа (дополнительно к отправке на thanks)
        sendToWebhook(payload, { form: submission.form });
      } catch (e2) {
        // игнорируем ошибки сохранения
      }

      // Перенаправление на страницу благодарности
      setTimeout(() => {
        window.location.href = 'thanks.html';
      }, 250);
    });
  }
}

// Работа с модальным окном просмотра отзывов
const reviewViewerModal = document.getElementById('reviewViewerModal');
const reviewViewerModalClose = document.getElementById('reviewViewerModalClose');
const reviewViewerImage = document.getElementById('reviewViewerImage');
const reviewCards = document.querySelectorAll('[data-review-image]');

function openReviewViewer(imageSrc, imageAlt) {
  reviewViewerImage.src = imageSrc;
  reviewViewerImage.alt = imageAlt;
  reviewViewerModal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeReviewViewer() {
  reviewViewerModal.classList.remove('is-open');
  document.body.style.overflow = '';
}

reviewCards.forEach(card => {
  card.addEventListener('click', () => {
    const imageSrc = card.getAttribute('data-review-image');
    const imageAlt = card.getAttribute('data-review-alt');
    openReviewViewer(imageSrc, imageAlt);
  });
});

reviewViewerModalClose.addEventListener('click', closeReviewViewer);

reviewViewerModal.addEventListener('click', (e) => {
  if (e.target === reviewViewerModal || e.target.classList.contains('review-viewer-modal__overlay')) {
    closeReviewViewer();
  }
});


// Отправка данных на вебхук на странице благодарности
(function sendWebhookOnThanks() {
  // Ждем загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendWebhookOnThanks);
    return;
  }

  try {
    // Определяем страницу "спасибо" по наличию разметки
    const isThanksPage = !!document.querySelector('.thanks-page');
    if (!isThanksPage) return;

    // Проверяем sessionStorage
    const raw = sessionStorage.getItem('car_service_submission');
    if (!raw) {
      console.warn('[Webhook] No submission data in sessionStorage');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('[Webhook] Failed to parse sessionStorage data:', e);
      return;
    }

    // Извлекаем payload и form
    const payload = parsed.payload || parsed;
    const form = parsed.form || 'unknown';

    // Строим envelope
    const envelope = buildWebhookEnvelope(payload, { form });

    // Отправляем на вебхук
    const cleanup = () => {
      try {
        sessionStorage.removeItem('car_service_submission');
        console.log('[Webhook] Submission sent and cleaned up');
      } catch (_) {}
    };

    // Отправляем с задержкой, чтобы убедиться, что страница загружена
    setTimeout(() => {
      dispatchWebhook(envelope, { onFinally: cleanup });
    }, 100);
  } catch (e) {
    console.error('[Webhook] Error in sendWebhookOnThanks:', e);
  }
})(); 

