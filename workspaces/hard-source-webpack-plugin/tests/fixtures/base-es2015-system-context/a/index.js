export default Promise.all([1, 2, 3, 4, 5].map(i => System.import('./' + i)))
.then(values => {
  const [m1, m2, m3, m4, m5] = values;
  return (m1 + m2 + m3 + m4 + m5);
});
