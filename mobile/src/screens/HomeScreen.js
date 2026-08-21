const handlePet = async () => {
    // Тактильная отдача при поглаживании (звук требует expo-av + аудио-файл).
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { phrase } = await mascot.pet();
      if (phrase) setBubbleText(phrase.phrase || 'Хихи, щекотно!');
    } catch {
      setBubbleText('Хихи, щекотно!');
    }
  };