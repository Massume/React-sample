const item = {
  imageURL: 'https://www.gwd.ru/upload/iblock/6fb/6fbf54b783e1313516e14bd8b694b69e.jpg',
  prise: '$1.275.00 4 37.172 sqft',
  address: '206 WARRICK STREET, COQULTLAM, BC',
};

const items = new Array(12).fill(item).map((obj, id) => ({...obj, id}));

export default items;
