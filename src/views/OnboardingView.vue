<script setup>
import ChildForm from '../components/ChildForm.vue'
</script>

<template>
  <div class="page onboarding">
    <div class="hero">
      <div class="hero-icon">🌙</div>
      <h1>Режим малыша</h1>
      <p class="muted">
        Отмечайте сон, прогулки и купание — приложение подскажет, когда укладывать
        в следующий раз, и поможет наладить режим. Все данные хранятся только на вашем устройстве.
      </p>
    </div>
    <div class="card">
      <h2>Расскажите о малыше</h2>
      <ChildForm />
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  padding-top: 40px;
  padding-bottom: 24px;
}

.hero {
  text-align: center;
  margin-bottom: 24px;
}

.hero-icon {
  font-size: 56px;
  margin-bottom: 8px;
}

.hero p {
  max-width: 320px;
  margin: 0 auto;
}
</style>
