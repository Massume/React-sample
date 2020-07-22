import React from 'react';
import PropTypes from 'prop-types';
import {FoundItem} from 'components';
import {bem} from 'utils/index';
import './style.styl';

const propTypes = {
  dataItems: PropTypes.arrayOf(PropTypes.object),
  hoverItem: PropTypes.func.isRequired,
  hoverHash: PropTypes.string,
  openPopup: PropTypes.func.isRequired,
  bigMap: PropTypes.bool,
};

const defaultProps = {
  dataItems: [],
  bigMap: false,
  hoverHash: '',
};

const block = bem('listFoundItems');

const ListFoundItems = (props) => {
  const {
    dataItems,
    hoverItem,
    hoverHash,
    openPopup,
    bigMap,
  } = props;
  return (
    <ul className={block()}>
      {dataItems.map(item => (
        item
        && (
        <li key={item.listing_hash} className={block('listItem')} style={bigMap ? {width: '100%'} : {}}>
          <FoundItem {...item} hoverItem={hoverItem} hoverHash={hoverHash} openPopup={openPopup} />
        </li>
        )
      ))}
    </ul>
  );
};


ListFoundItems.propTypes = propTypes;
ListFoundItems.defaultProps = defaultProps;

export default ListFoundItems;
