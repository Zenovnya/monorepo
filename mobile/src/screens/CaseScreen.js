const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(null); // null | 'right' | 'wrong'
  const [correctCount, setCorrectCount] = useState(route.params?.correctCount ?? 0);